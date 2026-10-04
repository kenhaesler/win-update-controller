using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
namespace UpdateController;

public record ProgressSnapshot(string OperationId, string Action, int? Percent, int? CurrentPercent, int? Index, int Count, string? Title, long? BytesDownloaded, long? TotalBytes, double ElapsedSeconds);
public static class ProgressChannel
{
    public static Action<ProgressSnapshot>? Sink;
    public static void Publish(ProgressSnapshot value) { try { Sink?.Invoke(value); } catch { /* A lost UI must never interrupt Windows servicing. */ } }
}
[ComVisible(true), ClassInterface(ClassInterfaceType.AutoDispatch)]
public sealed class UpdateCallback
{
    [DispId(0)] public void Invoke(object job, object callbackArgs) { }
}
public static class AsyncServicing
{
    static int? Percent(object? value) { if (value == null) return null; try { var n = Convert.ToInt32(value); return n is >= 0 and <= 100 ? n : null; } catch { return null; } }
    static long? Bytes(object? value) { if (value == null) return null; try { var n = Convert.ToInt64(value, CultureInfo.InvariantCulture); return n >= 0 ? n : null; } catch { return null; } }
    public static object Run(object taskObject, string action, Package[] packages, string operationId, Action<ProgressSnapshot> report, Action<int>? pause = null)
    {
        if (action is not ("download" or "install") || packages.Length is < 1 or > 100 || !Guid.TryParse(operationId, out _)) throw new ArgumentException("Invalid servicing progress request.");
        dynamic task = taskObject;
        var callback = new UpdateCallback();
        dynamic job = action == "install" ? task.BeginInstall(callback, callback, null) : task.BeginDownload(callback, callback, null);
        var elapsed = Stopwatch.StartNew();
        void Emit(ProgressSnapshot snapshot) { try { report(snapshot); } catch { /* Progress delivery is independent from servicing. */ } }
        try
        {
            while (!(bool)job.IsCompleted)
            {
                var snapshot = new ProgressSnapshot(operationId, action, null, null, null, packages.Length, null, null, null, elapsed.Elapsed.TotalSeconds);
                try
                {
                    dynamic progress = job.GetProgress();
                    int index = (int)progress.CurrentUpdateIndex;
                    bool validIndex = index >= 0 && index < packages.Length;
                    snapshot = snapshot with {
                        Percent = Percent((object)progress.PercentComplete), CurrentPercent = Percent((object)progress.CurrentUpdatePercentComplete),
                        Index = validIndex ? index + 1 : null, Title = validIndex ? packages[index].Title : null,
                        BytesDownloaded = action == "download" ? Bytes((object)progress.TotalBytesDownloaded) : null,
                        TotalBytes = action == "download" ? Bytes((object)progress.TotalBytesToDownload) : null
                    };
                }
                catch { /* Unknown COM progress remains indeterminate; the operation still owns its final result. */ }
                Emit(snapshot);
                (pause ?? Thread.Sleep)(1000);
            }
            return action == "install" ? task.EndInstall(job) : task.EndDownload(job);
        }
        finally { try { job.CleanUp(); } catch { } GC.KeepAlive(callback); }
    }
}
