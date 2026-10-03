using Microsoft.Win32;
using System.Text.Json;
namespace UpdateController;
public static class DriverRules
{
    const string Path = @"SOFTWARE\UpdateController\DriverRules";
    public static string Normalize(string value) => value.Trim().ToUpperInvariant();
    public static bool Matches(string? hardwareId, IEnumerable<DriverRule> rules) =>
        !string.IsNullOrWhiteSpace(hardwareId) && rules.Any(r => Normalize(r.HardwareId) == Normalize(hardwareId));
    public static DriverRule[] Read()
    {
        using var key = Registry.LocalMachine.OpenSubKey(Path);
        if (key == null) return [];
        var rules = new List<DriverRule>();
        foreach (var name in key.GetValueNames())
        {
            DriverRule? rule;
            try { rule = JsonSerializer.Deserialize<DriverRule>(key.GetValue(name) as string ?? "", Protocol.Json); }
            catch (JsonException) { throw new Exception("A driver exclusion is damaged. No driver installation was authorized; inspect the controller's exclusion records."); }
            if (rule == null || rule.Id != name || !Guid.TryParse(rule.Id, out _) || string.IsNullOrWhiteSpace(rule.HardwareId) || rule.HardwareId.Length > 1024 || rule.Label == null)
                throw new Exception("A driver exclusion is incomplete. No driver installation was authorized.");
            rules.Add(rule);
        }
        return rules.ToArray();
    }
    public static DriverRule[] Add(DriverMetadata driver, string label)
    {
        if (string.IsNullOrWhiteSpace(driver.HardwareId) || driver.HardwareId.Length > 1024) throw new Exception("Windows did not supply a usable driver hardware identity. Exclude this individual package instead.");
        var rules = Read();
        if (Matches(driver.HardwareId, rules)) return rules;
        var rule = new DriverRule(Guid.NewGuid().ToString(), Normalize(driver.HardwareId), label, DateTimeOffset.UtcNow.ToString("O"));
        using var key = Registry.LocalMachine.CreateSubKey(Path, true);
        key.SetValue(rule.Id, Protocol.Serialize(rule)); key.Flush();
        return Read();
    }
    public static DriverRule[] Remove(string id)
    {
        if (!Guid.TryParse(id, out _)) throw new ArgumentException("Invalid exclusion identity.");
        using var key = Registry.LocalMachine.OpenSubKey(Path, true);
        key?.DeleteValue(id, false); key?.Flush(); return Read();
    }
}
