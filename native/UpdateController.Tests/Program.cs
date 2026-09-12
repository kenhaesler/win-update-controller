using UpdateController;

int tests = 0;
void Assert(bool condition, string message) { tests++; if (!condition) throw new Exception(message); }
void Reject(Request request) { try { Protocol.Validate(request); throw new Exception("Accepted an invalid request"); } catch (ArgumentException) { tests++; } }
Reject(new Request("shell"));
Reject(new Request("download", [new("bad' or IsInstalled=0", 1)], ReviewToken:"x"));
Reject(new Request("install", []));
var identity = new UpdateRef(Guid.NewGuid().ToString(), 1);
Reject(new Request("install", [identity]));
Reject(new Request("review", [identity, identity], Action:"install"));
Reject(new Request("review", [identity], Action:"reboot"));
Protocol.Validate(new Request("status")); tests++;
Protocol.Validate(new Request("review", [identity], Action:"download")); tests++;
var snap = new PolicySnapshot(false, null, "applied", "2026-01-01");
Assert(Protocol.CanRestore(snap, 1), "App-owned policy must be restorable");
Assert(!Protocol.CanRestore(snap, 0), "Externally modified policy must be preserved");
Assert(!Protocol.CanRestore(snap, null), "Externally removed policy must be preserved");
Assert(!Protocol.CanRestore(snap with { State = "restored" }, 1), "Old backup must not overwrite later policies");
var package = new Package(identity.Id, 1, "Package", "Description", "Security", [], [], "2026-01-01", 12, false, "Required", false, false, []);
var token = Protocol.Fingerprint([package], [], "download");
Assert(token != Protocol.Fingerprint([package], [], "install"), "Review must bind action");
Assert(token != Protocol.Fingerprint([package with { Revision = 2 }], [], "download"), "Review must bind revision");
Assert(token != Protocol.Fingerprint([package with { Bundles = ["new component"] }], [], "download"), "Review must bind bundles");
Assert(token != Protocol.Fingerprint([package], [new License("terms", "changed terms")], "download"), "Review must bind license terms");
foreach (int? original in new int?[] { null, 0, 2, -1 })
{
    var store = new FakeStore { Value = original };
    PolicyTransaction.Enable(store);
    Assert(store.Value == 1 && store.Snapshot?.Value == original, "Enable preserves original value");
    PolicyTransaction.Enable(store);
    Assert(store.Snapshot?.Value == original, "Repeated enable must not overwrite original backup");
    PolicyTransaction.Restore(store);
    Assert(store.Value == original && store.Snapshot?.State == "restored", "Restore exact prior value/absence");
}
var external = new FakeStore { Value = 1 };
PolicyTransaction.Enable(external);
Assert(external.Snapshot == null, "Externally configured policy must not be owned");
var interrupted = new FakeStore { Value = 0, FailAfterWrite = true };
try { PolicyTransaction.Enable(interrupted); } catch (IOException) { }
Assert(interrupted.Value == 1 && interrupted.Snapshot?.State == "prepared", "Backup survives crash after policy write");
interrupted.FailAfterWrite = false;
PolicyTransaction.Enable(interrupted);
Assert(interrupted.Snapshot?.Value == 0, "Enable recovery preserves original backup");
interrupted.FailAfterWrite = true;
try { PolicyTransaction.Restore(interrupted); } catch (IOException) { }
Assert(interrupted.Value == 0 && interrupted.Snapshot?.State == "restoring", "Restore crash leaves recovery journal");
interrupted.FailAfterWrite = false;
PolicyTransaction.Restore(interrupted);
Assert(interrupted.Snapshot?.State == "restored", "Restore recovery is idempotent");
var changed = new FakeStore { Value = 0 };
PolicyTransaction.Enable(changed); changed.Value = 9;
try { PolicyTransaction.Restore(changed); throw new InvalidOperationException("Did not preserve external change"); } catch (Exception ex) when (ex is not InvalidOperationException) { }
Assert(changed.Value == 9, "External changes preserved");
var html = "<h1>KB1234 update</h1><h2>Improvements</h2><p>Fixes an application startup failure.</p><script>evil()</script><h2>Known issues</h2><p>A driver may fail.</p><h2>How to install</h2><p>Not a change.</p>";
var notes = ReleaseNotes.Parse(html, "https://support.microsoft.com/help/1234", ["1234"]);
Assert(notes.Sections.Length == 2 && !notes.Sections.Any(x => x.Text.Contains("evil") || x.Text.Contains("Not a change")), "Extract only relevant plain-text sections");
Assert(ReleaseNotes.Parse(html, "https://support.microsoft.com/help/1234", ["9999"]).Sections.Length == 0, "Reject mismatched KB source");
Assert(!ReleaseNotes.Allowed(new Uri("https://microsoft.com.evil.test")) && !ReleaseNotes.Allowed(new Uri("https://support.microsoft.com:9443")), "Reject untrusted origin and nonstandard ports");
var pipeName = "UpdateController-Test-" + Guid.NewGuid().ToString("N");
using (var server = HelperPipe.CreateServer(pipeName))
using (var client = new System.IO.Pipes.NamedPipeClientStream(".", pipeName, System.IO.Pipes.PipeDirection.InOut))
using (var account = System.Security.Principal.WindowsIdentity.GetCurrent())
{
    var connection = server.WaitForConnectionAsync();
    client.Connect(5000);
    connection.GetAwaiter().GetResult();
    HelperPipe.VerifyServerAccount(client);
    var security = System.IO.Pipes.PipesAclExtensions.GetAccessControl(server);
    Assert(account.User!.Equals(security.GetOwner(typeof(System.Security.Principal.SecurityIdentifier))), "Pipe owner must be account SID, regardless of elevation token owner");
    var rules = security.GetAccessRules(true, true, typeof(System.Security.Principal.SecurityIdentifier));
    Assert(security.AreAccessRulesProtected && rules.Count == 1 && rules[0]!.IdentityReference.Equals(account.User), "Only the same account receives pipe access");
    var write = Task.Run(() => client.WriteByte(42));
    Assert(server.ReadByte() == 42, "Authenticated pipe transfers messages");
    write.GetAwaiter().GetResult();
}
Console.WriteLine($"Passed {tests} protocol, pipe security, transaction recovery, and source-extraction assertions. No Windows settings changed.");

class FakeStore : IPolicyStore
{
    public int? Value;
    public PolicySnapshot? Snapshot;
    public bool FailAfterWrite;
    public int? ReadValue() => Value;
    public PolicySnapshot? ReadSnapshot() => Snapshot;
    public void SaveSnapshot(PolicySnapshot snapshot) => Snapshot = snapshot;
    public void WriteValue(int? value) { Value = value; if (FailAfterWrite) throw new IOException("Simulated process failure"); }
}
