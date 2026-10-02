using System.Net;
using System.Text.Json;

namespace UpdateController;

public static class AppRelease
{
    public static object Fetch()
    {
        using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(15), MaxResponseContentBufferSize = 1_000_000 };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("win-update-controller");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
        using var response = client.GetAsync("https://api.github.com/repos/kenhaesler/win-update-controller/releases/latest").GetAwaiter().GetResult();
        if (response.StatusCode == HttpStatusCode.NotFound) throw new Exception("No published controller release is available yet.");
        response.EnsureSuccessStatusCode();
        using var data = JsonDocument.Parse(response.Content.ReadAsStringAsync().GetAwaiter().GetResult());
        var root = data.RootElement;
        if (root.GetProperty("draft").GetBoolean() || root.GetProperty("prerelease").GetBoolean()) throw new Exception("No stable controller release is available.");
        return new { version = root.GetProperty("tag_name").GetString() };
    }
}
