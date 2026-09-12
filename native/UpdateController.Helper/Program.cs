using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

namespace UpdateController;

internal static class Program
{
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetNamedPipeServerProcessId(SafePipeHandle pipe, out uint pid);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetNamedPipeClientProcessId(SafePipeHandle pipe, out uint pid);

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            if (args.Length == 1 && args[0] == "--uninstall-policy-state")
            {
                using var gate = new Mutex(false, @"Global\UpdateController-Mutation");
                bool available;
                try { available = gate.WaitOne(0); } catch (AbandonedMutexException) { available = true; }
                if (!available) { Console.WriteLine("An update operation is active. Wait for it to finish before uninstalling."); return 20; }
                try { return Policy.Snapshot()?.State is "prepared" or "applied" or "restoring" ? 10 : 0; }
                finally { gate.ReleaseMutex(); }
            }
            if (args.Length == 1 && args[0] == "--restore-for-uninstall")
            {
                if (!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator)) throw new Exception("Administrator access is required to restore policy.");
                using var uninstallLock = new Mutex(false, @"Global\UpdateController-Mutation");
                bool acquired;
                try { acquired = uninstallLock.WaitOne(0); } catch (AbandonedMutexException) { acquired = true; }
                if (!acquired) throw new Exception("An update operation is active. Wait before uninstalling.");
                try { Policy.Restore(); Console.WriteLine("Previous policy restored."); return 0; }
                finally { uninstallLock.ReleaseMutex(); }
            }
            if (args.Length == 1 && args[0] == "--check-elevation")
            {
                Console.WriteLine(Elevate(new Request("status")));
                return 0;
            }
            if (args.Length == 3 && args[0] == "--worker") return Worker(args[1], args[2]);
            if (args.Length != 0) throw new ArgumentException("Unsupported helper arguments.");
            var line = Console.ReadLine() ?? throw new ArgumentException("Missing request.");
            if (line.Length > 100_000) throw new ArgumentException("Request too large.");
            var request = JsonSerializer.Deserialize<Request>(line, Protocol.Json) ?? throw new ArgumentException("Invalid request.");
            Protocol.Validate(request);
            if (request.Command is "download" or "install" or "enableManual" or "restorePolicy")
                Console.WriteLine(Elevate(request));
            else Console.WriteLine(Execute(request));
            return 0;
        }
        catch (Exception ex) { Console.WriteLine(Error(ex)); return 1; }
    }

    static string Error(Exception ex) => Protocol.Serialize(new { ok = false, error = ex.Message, code = $"0x{ex.HResult:X8}" });
    static string Execute(Request request)
    {
        try
        {
            Protocol.Validate(request);
            object result = request.Command switch
            {
                "status" => WindowsUpdates.Status(), "scan" => WindowsUpdates.Scan(), "history" => WindowsUpdates.History(), "notes" => ReleaseNotes.Fetch(request),
                "review" => WindowsUpdates.Prepare(request), "enableManual" => Policy.Enable(), "restorePolicy" => Policy.Restore(),
                "download" or "install" => WindowsUpdates.Run(request), _ => throw new ArgumentException("Unknown operation.")
            };
            return Protocol.Serialize(new { ok = true, data = result });
        }
        catch (Exception ex) { return Error(ex); }
    }

    static string Elevate(Request request)
    {
        // Only this broker knows the random pipe name and nonce. The worker executes one validated request.
        var pipeName = "UpdateController-" + Guid.NewGuid().ToString("N");
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        using var pipe = HelperPipe.CreateServer(pipeName);
        using var child = Process.Start(new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = true, Verb = "runas", Arguments = $"--worker {pipeName} {nonce}", WindowStyle = ProcessWindowStyle.Hidden }) ?? throw new Exception("The administrator helper did not start.");
        using var connectTimeout = new CancellationTokenSource(TimeSpan.FromMinutes(3));
        var connection = pipe.WaitForConnectionAsync(connectTimeout.Token);
        var exited = child.WaitForExitAsync(connectTimeout.Token);
        if (Task.WhenAny(connection, exited).GetAwaiter().GetResult() != connection)
            throw new Exception("The administrator helper exited before connecting. Use an administrator account on this PC and try again.");
        connection.GetAwaiter().GetResult();
        if (!GetNamedPipeClientProcessId(pipe.SafePipeHandle, out var clientPid) || clientPid != child.Id) throw new Exception("Administrator helper identity check failed.");
        using var reader = new StreamReader(pipe, leaveOpen: true);
        using var writer = new StreamWriter(pipe, leaveOpen: true) { AutoFlush = true };
        if (reader.ReadLineAsync(connectTimeout.Token).AsTask().GetAwaiter().GetResult() != nonce) throw new Exception("Administrator helper authentication failed.");
        writer.WriteLine(Protocol.Serialize(request));
        // The worker persists its result before replying. A broken UI connection never restarts an operation.
        return reader.ReadLine() ?? throw new Exception("Connection to the administrator helper ended. Check history before retrying.");
    }

    static int Worker(string pipeName, string nonce)
    {
        if (!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator)) throw new Exception("Administrator access is required.");
        if (!pipeName.StartsWith("UpdateController-") || pipeName.Length != 49 || nonce.Length != 64) throw new ArgumentException("Invalid worker handshake.");
        using var pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.None);
        pipe.Connect(30_000);
        HelperPipe.VerifyServerAccount(pipe);
        if (!GetNamedPipeServerProcessId(pipe.SafePipeHandle, out var serverPid)) throw new Exception("Cannot identify broker.");
        using var broker = Process.GetProcessById((int)serverPid);
        if (!string.Equals(broker.MainModule?.FileName, Environment.ProcessPath, StringComparison.OrdinalIgnoreCase)) throw new Exception("Untrusted broker executable.");
        using var reader = new StreamReader(pipe, leaveOpen: true);
        using var writer = new StreamWriter(pipe, leaveOpen: true) { AutoFlush = true };
        writer.WriteLine(nonce);
        var line = reader.ReadLine() ?? throw new Exception("Missing worker request.");
        if (line.Length > 100_000) throw new Exception("Request too large.");
        var request = JsonSerializer.Deserialize<Request>(line, Protocol.Json) ?? throw new Exception("Invalid worker request.");
        Protocol.Validate(request);
        using var mutex = new Mutex(false, @"Global\UpdateController-Mutation");
        bool locked;
        try { locked = mutex.WaitOne(0); } catch (AbandonedMutexException) { locked = true; }
        if (!locked) { writer.WriteLine(Error(new Exception("Another update operation is already running."))); return 1; }
        try { var result = Execute(request); writer.WriteLine(result); return 0; }
        finally { mutex.ReleaseMutex(); }
    }
}
