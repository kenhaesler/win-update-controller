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
            (int)update.InstallationBehavior.Impact == 2, (bool)update.EulaAccepted, bundles.ToArray(), (bool)update.IsHidden, DefenderEligible(update), ReadDriver(update), IsExcluded(update));
    }
    static DriverMetadata? ReadDriver(dynamic update)
    {
        if ((int)update.Type != 2) return null;
        string? Read(Func<object> get) { try { return Convert.ToString(get()); } catch { return null; } }
        return new DriverMetadata(Read(() => update.DriverHardwareID), Read(() => update.DriverModel), Read(() => update.DriverProvider),
            Read(() => update.DriverManufacturer), Read(() => update.DriverClass), Read(() => update.DriverVerDate));
    }
    static bool IsExcluded(dynamic update)
    {
        var rules = DriverRules.Read();
        if (rules.Length == 0) return false;
        DriverMetadata? driver = ReadDriver(update);
        if (driver != null && (string.IsNullOrWhiteSpace(driver.HardwareId) || DriverRules.Matches(driver.HardwareId, rules))) return true;
        for (int i = 0; i < update.BundledUpdates.Count; i++) if (IsExcluded(update.BundledUpdates.Item(i))) return true;
        return false;
    }
    public static object ExcludeDriver(Request request)
    {
        var item = request.Updates![0];
        dynamic searcher = Session().CreateUpdateSearcher(); searcher.Online = false;
        string identity = $"UpdateID='{item.Id}' and RevisionNumber={item.Revision} and IsInstalled=0";
        dynamic result = searcher.Search($"{identity} and IsHidden=0 or {identity} and IsHidden=1");
        if ((int)result.ResultCode != 2 || result.Updates.Count != 1) throw new Exception("The driver is no longer available. Check and review again.");
        dynamic update = result.Updates.Item(0);
        DriverMetadata? driver = ReadDriver(update);
        if (driver == null) throw new Exception("Only a driver update can create a device exclusion.");
        if (string.IsNullOrWhiteSpace(driver.HardwareId) || DriverRules.Normalize(driver.HardwareId) != DriverRules.Normalize(request.HardwareId!)) throw new Exception("The driver's hardware identity changed. Check and review the exclusion again.");
        return DriverRules.Add(driver, (string)update.Title);
    }
    static bool DefenderEligible(dynamic update)
    {
        try
        {
            var kb = new List<string>();
            for (int i = 0; i < update.KBArticleIDs.Count; i++) kb.Add((string)update.KBArticleIDs.Item(i));
            bool children = true;
            for (int i = 0; i < update.BundledUpdates.Count; i++) children &= DefenderEligible(update.BundledUpdates.Item(i));
            return Protocol.DefenderEligible(kb.ToArray(), (int)update.Type, (int)update.InstallationBehavior.RebootBehavior,
                (int)update.InstallationBehavior.Impact, (bool)update.IsHidden, (bool)update.EulaAccepted,
                (bool)update.InstallationBehavior.CanRequestUserInput, children);
        }
        catch { return false; } // Unknown metadata must never authorize automatic installation.
    }
    static void RequireDefender(dynamic collection)
    {
        dynamic info = Com("Microsoft.Update.SystemInfo");
        if ((bool)info.RebootRequired || KeyExists(@"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired") || KeyExists(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending"))
            throw new Exception("Defender automation skipped because Windows has a pending restart.");
        for (int i = 0; i < collection.Count; i++)
            if (!DefenderEligible(collection.Item(i))) throw new Exception("Defender update eligibility changed. Check for updates again; no automatic installation was started.");
    }
    public static object AutoDefender(Request request)
    {
        dynamic collection = Resolve(request.Updates!);
        RequireDefender(collection);
        Review download = ReviewCollection(collection, "download");
        var downloaded = (OperationRecord)Run(new Request("download", request.Updates, ReviewToken: download.ReviewToken), true);
        if (downloaded.State != "completed") return downloaded;
        collection = Resolve(request.Updates!);
        RequireDefender(collection);
        Review install = ReviewCollection(collection, "install");
        return Run(new Request("install", request.Updates, ReviewToken: install.ReviewToken), true);
    }
    public static object Scan()
    {
        dynamic session = Session();
        dynamic searcher = session.CreateUpdateSearcher();
        searcher.Online = true;
        dynamic result = searcher.Search("IsInstalled=0 and IsHidden=0 or IsInstalled=0 and IsHidden=1");
        if ((int)result.ResultCode != 2) throw new Exception("Windows could not complete the update search. Try checking again.");
        var updates = new List<Package>();
        for (int i = 0; i < result.Updates.Count; i++) updates.Add(Map(result.Updates.Item(i)));
        return new { updates, checkedAt = Now() };
    }
    public static object SetHidden(Request request)
    {
        bool hidden = request.Command == "hide";
        dynamic searcher = Session().CreateUpdateSearcher();
        searcher.Online = false;
        var results = new List<object>();
        foreach (var item in request.Updates!)
        {
            try
            {
                // Resolve the exact identity in either state, making retries idempotent.
                string identity = $"UpdateID='{item.Id}' and RevisionNumber={item.Revision} and IsInstalled=0";
                dynamic found = searcher.Search($"{identity} and IsHidden=0 or {identity} and IsHidden=1");
                if ((int)found.ResultCode != 2 || found.Updates.Count != 1)
                    throw new Exception("Update is no longer available. Check for updates again.");
                dynamic update = found.Updates.Item(0);
                if (hidden && (bool)update.IsMandatory) throw new Exception("Windows does not allow hiding this mandatory update.");
                update.IsHidden = hidden;
                if ((bool)update.IsHidden != hidden) throw new Exception("Windows did not retain the requested hidden state.");
                results.Add(new { item.Id, item.Revision, success = true, error = (string?)null });
            }
            catch (Exception ex)
            {
                results.Add(new { item.Id, item.Revision, success = false, error = ex.Message });
            }
        }
        return new { results };
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
            if (IsExcluded(found.Updates.Item(0))) throw new Exception("A selected package or bundled driver matches a device exclusion. Remove that exclusion in Settings before reviewing installation.");
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
        OperationJournal.Write(operation);
    }
    static OperationRecord? ReadOperation()
    {
        using var key = Registry.LocalMachine.OpenSubKey(Policy.StatePath);
        var json = key?.GetValue("LastOperation") as string;
        return OperationJournal.Parse(json);
    }
    public static object Run(Request request, bool automatic = false)
    {
        dynamic collection = Resolve(request.Updates!);
        if (automatic) RequireDefender(collection);
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
            review.Updates.Select(x => new OperationResult(x.Id, x.Title, "Pending", Revision: x.Revision)).ToArray(), false, null);
        WriteOperation(record);
        try
        {
            if (!automatic) for (int i = 0; i < collection.Count; i++) AcceptLicenses(collection.Item(i));
            dynamic result = AsyncServicing.Run((object)task, request.Command, review.Updates, record.Id, ProgressChannel.Publish);
            var results = new List<OperationResult>();
            for (int i = 0; i < collection.Count; i++)
            {
                dynamic item = result.GetUpdateResult(i);
                results.Add(new OperationResult((string)collection.Item(i).Identity.UpdateID, (string)collection.Item(i).Title, Protocol.Outcome((int)item.ResultCode), $"0x{(int)item.HResult:X8}", (int)collection.Item(i).Identity.RevisionNumber));
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
        searcher.Online = false;
        var operations = OperationJournal.ReadAll().Select(o => o.State is "running" or "uncertain" && o.Action is "install" or "download" ? ObserveCurrent(o, (object)searcher) : o).ToArray();
        return new { entries, lastOperation = ReadOperation(), operations };
    }
    public static object LogAction(Request request, Func<object> action)
    {
        var record = new OperationRecord(Guid.NewGuid().ToString(), request.Command, "running", Now(), null,
            (request.Updates ?? []).Select(u => new OperationResult(u.Id, u.Id, "Pending", Revision: u.Revision)).ToArray(), false, null);
        WriteOperation(record);
        try
        {
            var data = action();
            var results = record.Results;
            if (request.Command is "hide" or "unhide")
            {
                var json = JsonSerializer.SerializeToElement(data, Protocol.Json);
                results = json.GetProperty("results").EnumerateArray().Select(r => new OperationResult(
                    r.GetProperty("id").GetString()!, r.GetProperty("id").GetString()!, r.GetProperty("success").GetBoolean() ? "Succeeded" : "Failed",
                    r.GetProperty("error").GetString(), r.GetProperty("revision").GetInt32())).ToArray();
            }
            WriteOperation(record with { State = results.Any(r => r.Result == "Failed") ? "partialOrFailed" : "completed", Results = results, FinishedAt = Now(), Message = "Request finished." });
            return data;
        }
        catch (Exception ex) { WriteOperation(record with { State = "uncertain", FinishedAt = Now(), Message = ex.Message }); throw; }
    }
    public static object Reconcile(Request request)
    {
        var record = OperationJournal.ReadAll().FirstOrDefault(r => r.Id == request.OperationId) ?? throw new Exception("This operation is no longer available.");
        if (record.Action is not ("install" or "download")) return record;
        dynamic searcher = Session().CreateUpdateSearcher(); searcher.Online = false;
        return ObserveCurrent(record, (object)searcher);
    }
    static OperationRecord ObserveCurrent(OperationRecord record, object searcherObject)
    {
        dynamic searcher = searcherObject;
        return OperationJournal.Observe(record, r => {
            if (!Guid.TryParse(r.Id, out _) || r.Revision is not >= 0) return "Exact revision unavailable in this older record.";
            try {
                var identity = $"UpdateID='{r.Id}' and RevisionNumber={r.Revision}";
                dynamic result = searcher.Search($"{identity} and IsInstalled=0 and IsHidden=0 or {identity} and IsInstalled=0 and IsHidden=1 or {identity} and IsInstalled=1");
                if ((int)result.ResultCode != 2 || result.Updates.Count != 1) return "Not present in current Windows metadata; completion remains unknown.";
                dynamic update = result.Updates.Item(0);
                return (bool)update.IsInstalled ? "Currently installed" : (bool)update.IsDownloaded ? "Currently downloaded; not installed" : "Currently not downloaded or installed";
            } catch { return "Current state unavailable; check Windows history."; }
        });
    }
}
