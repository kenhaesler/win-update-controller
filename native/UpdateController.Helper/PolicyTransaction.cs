namespace UpdateController;

public interface IPolicyStore
{
    int? ReadValue();
    PolicySnapshot? ReadSnapshot();
    void SaveSnapshot(PolicySnapshot snapshot);
    void WriteValue(int? value);
}

public static class PolicyTransaction
{
    public static void Enable(IPolicyStore store)
    {
        var old = store.ReadValue();
        var snapshot = store.ReadSnapshot();
        if (snapshot?.State is "prepared" or "applied" or "restoring")
        {
            if (old != 1 || snapshot.State == "restoring") throw new Exception("The previous policy transaction needs restoration or conflict resolution before enabling again.");
            store.SaveSnapshot(snapshot with { State = "applied" }); return;
        }
        if (old == 1) return; // External policy: never claim ownership or invent a backup.
        snapshot = new PolicySnapshot(old.HasValue, old, "prepared", DateTimeOffset.UtcNow.ToString("O"));
        store.SaveSnapshot(snapshot);
        if (store.ReadValue() != old) throw new Exception("The policy changed during preparation. It has been preserved.");
        store.WriteValue(1);
        if (store.ReadValue() != 1) throw new Exception("Windows did not retain the requested policy. Backup is preserved.");
        store.SaveSnapshot(snapshot with { State = "applied" });
    }
    public static void Restore(IPolicyStore store)
    {
        var snapshot = store.ReadSnapshot() ?? throw new Exception("This app has no policy backup to restore.");
        if (snapshot.State == "restoring" && store.ReadValue() == snapshot.Value)
        { store.SaveSnapshot(snapshot with { State = "restored" }); return; }
        if (!Protocol.CanRestore(snapshot, store.ReadValue())) throw new Exception("The policy changed outside this app. It has been preserved; automatic restoration is unavailable.");
        store.SaveSnapshot(snapshot with { State = "restoring" });
        if (store.ReadValue() != 1) throw new Exception("The policy changed during restoration. It has been preserved.");
        store.WriteValue(snapshot.Existed ? snapshot.Value : null);
        if (store.ReadValue() != snapshot.Value) throw new Exception("Policy restoration could not be verified. Backup is preserved.");
        store.SaveSnapshot(snapshot with { State = "restored" });
    }
}
