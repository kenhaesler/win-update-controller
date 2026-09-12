using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;

namespace UpdateController;

internal static class HelperPipe
{
    internal static NamedPipeServerStream CreateServer(string name)
    {
        using var identity = WindowsIdentity.GetCurrent();
        var user = identity.User ?? throw new UnauthorizedAccessException("Cannot identify the current account.");
        var security = new PipeSecurity();
        security.SetAccessRuleProtection(true, false);
        security.SetOwner(user);
        security.AddAccessRule(new PipeAccessRule(user, PipeAccessRights.FullControl, AccessControlType.Allow));
        // CurrentUserOnly uses the token's Owner SID in .NET 8. Elevation changes
        // that SID to Administrators, while the actual User SID stays the same.
        return NamedPipeServerStreamAcl.Create(name, PipeDirection.InOut, 1,
            PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 0, 0, security);
    }

    internal static void VerifyServerAccount(NamedPipeClientStream pipe)
    {
        using var identity = WindowsIdentity.GetCurrent();
        var owner = pipe.GetAccessControl().GetOwner(typeof(SecurityIdentifier));
        if (identity.User is null || !identity.User.Equals(owner))
            throw new UnauthorizedAccessException("The administrator helper must run under the same Windows account as the app.");
    }
}
