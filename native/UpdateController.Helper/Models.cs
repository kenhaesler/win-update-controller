using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace UpdateController;

public record UpdateRef(string Id, int Revision);
public record Request(string Command, UpdateRef[]? Updates = null, string? Action = null, string? ReviewToken = null, bool AcceptLicenses = false, string? Url = null, string[]? KbIds = null, string? OperationId = null);
public record Package(string Id, int Revision, string Title, string Description, string Category, string[] KbIds, string[] SupportUrls, string Date, decimal Size, bool Downloaded, string Restart, bool Exclusive, bool EulaAccepted, string[] Bundles, bool Hidden = false, bool AutoInstallEligible = false);
public record License(string Title, string Text);
public record Review(Package[] Updates, License[] Licenses, string ReviewToken, string Action);
public record PolicySnapshot(bool Existed, int? Value, string State, string CreatedAt);
public record OperationResult(string Id, string Title, string Result, string? Code = null, int? Revision = null, string? ObservedState = null);
public record OperationRecord(string Id, string Action, string State, string StartedAt, string? FinishedAt, OperationResult[] Results, bool RestartRequired, string? Message);

public static class Protocol
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static string Serialize(object? value) => JsonSerializer.Serialize(value, Json);
    public static void Validate(Request request)
    {
        if (!new[] { "status", "scan", "history", "reconcile", "review", "notes", "appRelease", "autoDefender", "download", "install", "hide", "unhide", "enableManual", "restorePolicy" }.Contains(request.Command))
            throw new ArgumentException("Unknown operation.");
        if (request.Command == "reconcile" && !Guid.TryParse(request.OperationId, out _)) throw new ArgumentException("Invalid operation identity.");
        if (request.Command is "review" or "download" or "install" or "hide" or "unhide" or "autoDefender")
        {
            if (request.Updates is not { Length: > 0 and <= 100 }) throw new ArgumentException("Select between 1 and 100 update packages.");
            if (request.Updates.Any(x => !Guid.TryParse(x.Id, out _) || x.Revision < 0)) throw new ArgumentException("Invalid update identity.");
            if (request.Updates.DistinctBy(x => x.Id).Count() != request.Updates.Length) throw new ArgumentException("Duplicate update identities.");
        }
        if (request.Command == "review" && request.Action is not ("download" or "install")) throw new ArgumentException("Invalid review action.");
        if (request.Command is "download" or "install" && string.IsNullOrEmpty(request.ReviewToken)) throw new ArgumentException("Review the selected updates first.");
    }
    public static string Fingerprint(Package[] packages, License[] licenses, string action) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Serialize(new { action, packages = packages.OrderBy(x => x.Id), licenses }))));
    public static bool CanRestore(PolicySnapshot snapshot, int? current) => snapshot.State is "prepared" or "applied" or "restoring" && current == 1;
    public static string Outcome(int code) => code switch { 2 => "Succeeded", 3 => "Succeeded with errors", 4 => "Failed", 5 => "Aborted", _ => "Unknown" };
    // An explicit allowlist avoids localized title matching and broad security classifications.
    public static bool DefenderEligible(string[] kbIds, int type, int reboot, int impact, bool hidden, bool accepted, bool interactive, bool childrenEligible) =>
        kbIds.Length > 0 && kbIds.All(x => x is "2267602" or "4052623") && type == 1 && reboot == 0 && impact is 0 or 1 && !hidden && accepted && !interactive && childrenEligible;
}
