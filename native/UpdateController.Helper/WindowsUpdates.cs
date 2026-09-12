using Microsoft.Win32;
using System.Text.Json;

namespace UpdateController;

public static class WindowsUpdates
{
    static dynamic Com(string progId) => Activator.CreateInstance(Type.GetTypeFromProgID(progId) ?? throw new Exception($"Windows component {progId} is unavailable."))!;
    static dynamic Session()
    {
        dynamic session = Com("Microsoft.Update.Session");
        session.ClientApplicationID = "Update Controller";
        return session;
    }
    static string Now() => DateTimeOffset.UtcNow.ToString("O");
    static bool KeyExists(string path) { using var key = Registry.LocalMachine.OpenSubKey(path); return key != null; }
    public static object Status()
    {
        using var os = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
        var edition = os?.GetValue("EditionID") as string ?? "Unknown";
        var build = os?.GetValue("CurrentBuildNumber") as string ?? "Unknown";
        var conflicts = Policy.Conflicts();
        var manual = Policy.Current() == 1;
        var snapshot = Policy.Snapshot();
        if (snapshot?.State is "prepared" or "applied" && !manual) conflicts = [..conflicts, "The manual-mode policy changed outside this app."];
        var supported = int.TryParse(build, out var n) && n >= 22000 && edition is "Professional" or "ProfessionalWorkstation" or "Enterprise" or "Education";
        bool? agentDisabled = null;
        try { dynamic automatic = Com("Microsoft.Update.AutoUpdate"); agentDisabled = (int)automatic.Settings.NotificationLevel == 1; } catch { }
        var pending = KeyExists(@"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired") || KeyExists(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending");
        try { dynamic info = Com("Microsoft.Update.SystemInfo"); pending |= (bool)info.RebootRequired; } catch { }
        return new { edition, build, version = os?.GetValue("DisplayVersion") as string ?? "", manualConfigured = manual, agentDisabled, supported, conflicts, restartPending = pending, canRestore = snapshot?.State is "prepared" or "applied" or "restoring", checkedAt = Now(), lastOperation = ReadOperation(), verification = "Policy readback only; reboot behavior has not been certified for this build." };
    }
    static Package Map(dynamic update)
    {
        var kb = new List<string>();
        for (int i = 0; i < update.KBArticleIDs.Count; i++) kb.Add((string)update.KBArticleIDs.Item(i));
        var urls = new List<string>();
        for (int i = 0; i < update.MoreInfoUrls.Count; i++) urls.Add((string)update.MoreInfoUrls.Item(i));
        string support = update.SupportUrl;
        if (!string.IsNullOrWhiteSpace(support)) urls.Add(support);
        if (urls.Count == 0) urls.AddRange(kb.Where(x => x.All(char.IsDigit)).Select(x => "https://support.microsoft.com/help/" + x));
        var category = (int)update.Type == 2 ? "Drivers" : (bool)update.BrowseOnly ? "Optional" : "Recommended";
        for (int i = 0; i < update.Categories.Count; i++)
            if (((string)update.Categories.Item(i).CategoryID).Equals("0fa1201d-4330-4fa8-8ae9-b877473b6441", StringComparison.OrdinalIgnoreCase)) category = "Security";
        var bundles = new List<string>();
        for (int i = 0; i < update.BundledUpdates.Count; i++)
        {
            dynamic child = update.BundledUpdates.Item(i);
            bundles.Add($"{child.Title} [{child.Identity.UpdateID}:{child.Identity.RevisionNumber}]");
        }
        int reboot = (int)update.InstallationBehavior.RebootBehavior;
        return new Package((string)update.Identity.UpdateID, (int)update.Identity.RevisionNumber, (string)update.Title, (string)update.Description,
            category, kb.ToArray(), urls.Distinct().ToArray(), ((DateTime)update.LastDeploymentChangeTime).ToUniversalTime().ToString("O"),
            Convert.ToDecimal((object)update.MaxDownloadSize), (bool)update.IsDownloaded, reboot switch { 0 => "Not expected", 1 => "Required", _ => "May be required" },
            (int)update.InstallationBehavior.Impact == 2, (bool)update.EulaAccepted, bundles.ToArray());
    }
    public static object Scan()
    {
        dynamic session = Session();
        dynamic searcher = session.CreateUpdateSearcher();
        searcher.Online = true;
        dynamic result = searcher.Search("IsInstalled=0 and IsHidden=0");
        if ((int)result.ResultCode != 2) throw new Exception("Windows could not complete the update search. Try checking again.");
        var updates = new List<Package>();
        for (int i = 0; i < result.Updates.Count; i++) updates.Add(Map(result.Updates.Item(i)));
        return new { updates, checkedAt = Now() };
    }
    static dynamic Resolve(UpdateRef[] selected)
    {
        dynamic session = Session();
        dynamic searcher = session.CreateUpdateSearcher();
        searcher.Online = false;
        dynamic collection = Com("Microsoft.Update.UpdateColl");
        foreach (var item in selected.OrderBy(x => x.Id))
        {
            // Protocol validates GUIDs/revisions before interpolation; only exact approved identities resolve.
            dynamic found = searcher.Search($"UpdateID='{item.Id}' and RevisionNumber={item.Revision} and IsInstalled=0 and IsHidden=0");
            if ((int)found.ResultCode != 2 || found.Updates.Count != 1) throw new Exception("A selected update is no longer available. Check for updates and review your selection again.");
            collection.Add(found.Updates.Item(0));
        }
        return collection;
    }
    static Review ReviewCollection(dynamic collection, string action)
    {
        var packages = new List<Package>();
        var licenses = new List<License>();
        for (int i = 0; i < collection.Count; i++)
        {
            dynamic update = collection.Item(i);
            packages.Add(Map(update));
            CollectLicenses(update, licenses);
        }
        if (packages.Count > 1 && packages.Any(x => x.Exclusive)) throw new Exception("One selected update must be installed alone. Select it separately.");
        if (action == "install" && packages.Any(x => !x.Downloaded)) throw new Exception("Download all selected packages before installing them.");
        var ps = packages.ToArray(); var ls = licenses.Distinct().ToArray();
        return new Review(ps, ls, Protocol.Fingerprint(ps, ls, action), action);
    }
    static void CollectLicenses(dynamic update, List<License> licenses)
    {
        if (!(bool)update.EulaAccepted) licenses.Add(new License((string)update.Title, (string)update.EulaText));
        for (int i = 0; i < update.BundledUpdates.Count; i++) CollectLicenses(update.BundledUpdates.Item(i), licenses);
    }
    static void AcceptLicenses(dynamic update)
    {
        if (!(bool)update.EulaAccepted) update.AcceptEula();
        for (int i = 0; i < update.BundledUpdates.Count; i++) AcceptLicenses(update.BundledUpdates.Item(i));
    }
    public static Review Prepare(Request request) => ReviewCollection(Resolve(request.Updates!), request.Action!);
    static void WriteOperation(OperationRecord operation)
    {
        using var key = Registry.LocalMachine.CreateSubKey(Policy.StatePath, true);
        key.SetValue("LastOperation", Protocol.Serialize(operation)); key.Flush();
    }
    static OperationRecord? ReadOperation()
    {
        using var key = Registry.LocalMachine.OpenSubKey(Policy.StatePath);
        var json = key?.GetValue("LastOperation") as string;
        return json == null ? null : JsonSerializer.Deserialize<OperationRecord>(json, Protocol.Json);
    }
    public static object Run(Request request)
    {
        dynamic collection = Resolve(request.Updates!);
        Review review = ReviewCollection(collection, request.Command);
        if (!string.Equals(review.ReviewToken, request.ReviewToken, StringComparison.Ordinal)) throw new Exception("The update details changed. Review the selection again before proceeding.");
        if (review.Licenses.Length > 0 && !request.AcceptLicenses) throw new Exception("Review and accept the license terms before proceeding.");
        dynamic session = Session();
        dynamic task = request.Command == "install" ? session.CreateUpdateInstaller() : session.CreateUpdateDownloader();
        task.Updates = collection;
        if (request.Command == "install")
        {
            task.AllowSourcePrompts = false; task.ForceQuiet = true;
            if ((bool)task.IsBusy) throw new Exception("Windows is already installing updates. Wait for that operation to finish.");
            if ((bool)task.RebootRequiredBeforeInstallation) throw new Exception("Windows needs a restart before another installation. No updates were installed by this request.");
        }
        var record = new OperationRecord(Guid.NewGuid().ToString(), request.Command, "running", Now(), null,
            review.Updates.Select(x => (object)new { x.Id, x.Title, result = "Pending" }).ToArray(), false, null);
        WriteOperation(record);
        try
        {
            for (int i = 0; i < collection.Count; i++) AcceptLicenses(collection.Item(i));
            dynamic result = request.Command == "install" ? task.Install() : task.Download();
            var results = new List<object>();
            for (int i = 0; i < collection.Count; i++)
            {
                dynamic item = result.GetUpdateResult(i);
                results.Add(new { id = (string)collection.Item(i).Identity.UpdateID, title = (string)collection.Item(i).Title, result = Protocol.Outcome((int)item.ResultCode), code = $"0x{(int)item.HResult:X8}" });
            }
            bool restart = request.Command == "install" && (bool)result.RebootRequired;
            record = record with { State = (int)result.ResultCode == 2 ? "completed" : "partialOrFailed", FinishedAt = Now(), Results = results.ToArray(), RestartRequired = restart, Message = Protocol.Outcome((int)result.ResultCode) };
            WriteOperation(record);
            return record;
        }
        catch (Exception ex)
        {
            WriteOperation(record with { State = "uncertain", FinishedAt = Now(), Message = ex.Message + " Check Windows update history before retrying." });
            throw;
        }
    }
    public static object History()
    {
        dynamic session = Session(); dynamic searcher = session.CreateUpdateSearcher();
        int count = Math.Min((int)searcher.GetTotalHistoryCount(), 100);
        var entries = new List<object>();
        if (count > 0)
        {
            dynamic history = searcher.QueryHistory(0, count);
            for (int i = 0; i < history.Count; i++)
            {
                dynamic entry = history.Item(i);
                entries.Add(new { title = (string)entry.Title, date = ((DateTime)entry.Date).ToUniversalTime().ToString("O"), result = Protocol.Outcome((int)entry.ResultCode), code = $"0x{(int)entry.HResult:X8}", action = (int)entry.Operation == 1 ? "Installation" : "Uninstallation", client = (string)entry.ClientApplicationID });
            }
        }
        return new { entries, lastOperation = ReadOperation() };
    }
}
