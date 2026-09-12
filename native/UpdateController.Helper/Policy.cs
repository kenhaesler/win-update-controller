using Microsoft.Win32;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace UpdateController;

public static class Policy
{
    public const string AuPath = @"SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU";
    public const string StatePath = @"SOFTWARE\UpdateController";
    const string WuPath = @"SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate";
    [DllImport("netapi32.dll", CharSet = CharSet.Unicode)] static extern int NetGetJoinInformation(string? server, out IntPtr name, out int status);
    [DllImport("netapi32.dll")] static extern int NetApiBufferFree(IntPtr buffer);

    public static int? Current()
    {
        using var key = Registry.LocalMachine.OpenSubKey(AuPath);
        var value = key?.GetValue("NoAutoUpdate");
        if (value == null) return null;
        if (key!.GetValueKind("NoAutoUpdate") != RegistryValueKind.DWord) throw new Exception("NoAutoUpdate has an unexpected registry type. Existing data was preserved.");
        return (int)value;
    }
    public static PolicySnapshot? Snapshot()
    {
        using var key = Registry.LocalMachine.OpenSubKey(StatePath);
        var json = key?.GetValue("PolicySnapshot") as string;
        return json == null ? null : JsonSerializer.Deserialize<PolicySnapshot>(json, Protocol.Json);
    }
    static void Save(PolicySnapshot snapshot)
    {
        using var key = Registry.LocalMachine.CreateSubKey(StatePath, true);
        key.SetValue("PolicySnapshot", Protocol.Serialize(snapshot)); key.Flush();
    }
    public static string[] Conflicts()
    {
        var results = new List<string>();
        var code = NetGetJoinInformation(null, out var name, out var status);
        if (name != IntPtr.Zero) NetApiBufferFree(name);
        if (code != 0) results.Add("Domain management status could not be determined.");
        else if (status == 3) results.Add("This PC is joined to a Windows domain.");
        using var mdm = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\PolicyManager\current\device\Update");
        if (mdm != null && mdm.GetValueNames().Any(x => x.EndsWith("_WinningProvider"))) results.Add("An organization manages Windows update policies.");
        using var wu = Registry.LocalMachine.OpenSubKey(WuPath);
        if (wu?.GetValue("WUServer") != null) results.Add("A managed update server is configured.");
        if (wu?.GetValueNames().Any(x => x.Contains("Deadline", StringComparison.OrdinalIgnoreCase)) == true) results.Add("Update deadline policies may override manual control, including zero-day deadlines.");
        return results.ToArray();
    }
    public static void Guard()
    {
        using var os = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
        if (!(os?.GetValue("EditionID") as string is "Professional" or "ProfessionalWorkstation" or "Enterprise" or "Education") || !int.TryParse(os?.GetValue("CurrentBuildNumber") as string, out var build) || build < 22000)
            throw new Exception("Manual mode currently supports Windows 11 Pro, Enterprise and Education only.");
        var conflicts = Conflicts();
        if (conflicts.Length > 0) throw new Exception(string.Join(" ", conflicts) + " Existing policies were preserved.");
    }
    private sealed class RegistryPolicyStore : IPolicyStore
    {
        public int? ReadValue() => Current();
        public PolicySnapshot? ReadSnapshot() => Snapshot();
        public void SaveSnapshot(PolicySnapshot snapshot) => Save(snapshot);
        public void WriteValue(int? value)
        {
            using var key = Registry.LocalMachine.CreateSubKey(AuPath, true);
            if (value.HasValue) key.SetValue("NoAutoUpdate", value.Value, RegistryValueKind.DWord);
            else key.DeleteValue("NoAutoUpdate", false);
            key.Flush();
        }
    }
    public static object Enable() { Guard(); PolicyTransaction.Enable(new RegistryPolicyStore()); return WindowsUpdates.Status(); }
    public static object Restore() { PolicyTransaction.Restore(new RegistryPolicyStore()); return WindowsUpdates.Status(); }
}
