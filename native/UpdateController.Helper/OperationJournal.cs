using Microsoft.Win32;
using System.Text.Json;
namespace UpdateController;

public static class OperationJournal
{
    const string Path = @"SOFTWARE\UpdateController\Operations";
    public static void Write(OperationRecord operation)
    {
        if (!Guid.TryParse(operation.Id, out _)) throw new ArgumentException("Invalid operation identity.");
        using var log = Registry.LocalMachine.CreateSubKey(Path, true);
        log.SetValue(operation.Id, Protocol.Serialize(operation)); log.Flush();
        using var state = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\UpdateController", true);
        state.SetValue("LastOperation", Protocol.Serialize(operation)); state.Flush();
    }
    public static OperationRecord[] ReadAll()
    {
        var records = new List<OperationRecord>();
        using var log = Registry.LocalMachine.OpenSubKey(Path);
        if (log != null) foreach (var name in log.GetValueNames())
        {
            var record = Parse(log.GetValue(name) as string);
            if (record != null) records.Add(record);
        }
        using var state = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\UpdateController");
        var legacy = Parse(state?.GetValue("LastOperation") as string);
        if (legacy != null && records.All(r => r.Id != legacy.Id)) records.Add(legacy);
        return records.OrderByDescending(r => r.StartedAt).ToArray();
    }
    public static OperationRecord? Parse(string? json)
    {
        try {
            var record = json == null ? null : JsonSerializer.Deserialize<OperationRecord>(json, Protocol.Json);
            return record != null && Guid.TryParse(record.Id, out _) && !string.IsNullOrEmpty(record.Action) &&
                !string.IsNullOrEmpty(record.State) && DateTimeOffset.TryParse(record.StartedAt, out _) && record.Results != null &&
                record.Results.All(r => r != null && r.Id != null && r.Title != null && r.Result != null) ? record : null;
        }
        catch (JsonException) { return null; }
    }
    // Observation is separate from the recorded outcome: another updater may have installed the package.
    public static OperationRecord Observe(OperationRecord record, Func<OperationResult, string> observe) => record with {
        Results = record.Results.Select(r => r with { ObservedState = observe(r) }).ToArray()
    };
}
