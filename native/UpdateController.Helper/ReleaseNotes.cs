using AngleSharp.Html.Parser;
using System.Net;
using System.Text.RegularExpressions;

namespace UpdateController;

public record NotesSection(string Heading, string Text);
public record Notes(string Source, string RetrievedAt, string Title, NotesSection[] Sections, string? UnavailableReason);

public static class ReleaseNotes
{
    public static bool Allowed(Uri url) => url.Scheme == "https" && string.IsNullOrEmpty(url.UserInfo) && url.IsDefaultPort &&
        (url.Host == "microsoft.com" || url.Host.EndsWith(".microsoft.com", StringComparison.OrdinalIgnoreCase));
    public static Notes Fetch(Request request)
    {
        if (!Uri.TryCreate(request.Url, UriKind.Absolute, out var url) || !Allowed(url)) throw new ArgumentException("Release notes require an official Microsoft HTTPS URL.");
        using var handler = new HttpClientHandler { AllowAutoRedirect = false, AutomaticDecompression = DecompressionMethods.All, UseDefaultCredentials = false, UseCookies = false };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(20) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("UpdateController/0.1");
        for (int redirects = 0; redirects < 6; redirects++)
        {
            using var response = client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead).GetAwaiter().GetResult();
            if ((int)response.StatusCode is >= 300 and < 400)
            {
                var location = response.Headers.Location ?? throw new Exception("Microsoft returned a redirect without a destination.");
                url = location.IsAbsoluteUri ? location : new Uri(url, location);
                if (!Allowed(url)) throw new Exception("The source redirects outside Microsoft HTTPS pages. Open the original official link to inspect it.");
                continue;
            }
            response.EnsureSuccessStatusCode();
            if (!(response.Content.Headers.ContentType?.MediaType?.Contains("html") ?? false)) throw new Exception("This source is not an HTML release-note page.");
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            using var stream = response.Content.ReadAsStream(timeout.Token);
            using var buffer = new MemoryStream();
            var chunk = new byte[8192];
            while (true)
            {
                int count = stream.ReadAsync(chunk.AsMemory(), timeout.Token).AsTask().GetAwaiter().GetResult();
                if (count == 0) break;
                if (buffer.Length + count > 3_000_000) throw new Exception("The source is too large to show safely inside the app. Open the official link instead.");
                buffer.Write(chunk, 0, count);
            }
            return Parse(System.Text.Encoding.UTF8.GetString(buffer.ToArray()), url.ToString(), request.KbIds ?? []);
        }
        throw new Exception("Too many redirects while loading official notes.");
    }
    public static Notes Parse(string html, string url, string[] kbIds)
    {
        var doc = new HtmlParser().ParseDocument(html);
        foreach (var node in doc.QuerySelectorAll("script,style,nav,footer,header,aside")) node.Remove();
        string Clean(string text) => Regex.Replace(text, @"\s+", " ").Trim();
        var title = Clean(doc.QuerySelector("h1")?.TextContent ?? doc.Title ?? "Official Microsoft notes");
        if (kbIds.Length > 0 && !kbIds.Any(kb => Regex.IsMatch(title, $@"\bKB\s*{Regex.Escape(kb)}\b", RegexOptions.IgnoreCase)))
            return new Notes(url, DateTimeOffset.UtcNow.ToString("O"), title, [], "This is a general support page, not release notes matched to this KB. Use the official link for more information.");
        var sections = new List<NotesSection>();
        var nodes = doc.QuerySelectorAll("h2,h3,p,li,tr");
        string? heading = null; var paragraphs = new List<string>();
        void Flush() { if (heading != null && paragraphs.Count > 0) sections.Add(new NotesSection(heading, string.Join("\n\n", paragraphs.Distinct()).Trim())); paragraphs.Clear(); }
        foreach (var node in nodes)
        {
            if (node.LocalName is "h2" or "h3")
            {
                Flush();
                var text = Clean(node.TextContent);
                heading = Regex.IsMatch(text, @"^(Highlights|Improvements|Known issues|Summary|What's new|Fixes)", RegexOptions.IgnoreCase) ? text : null;
            }
            else if (heading != null && !(node.ParentElement?.Closest("li,tr") != null))
            {
                var text = Clean(node.TextContent);
                if (text.Length > 10 && paragraphs.Sum(x => x.Length) < 12_000) paragraphs.Add(text.Length > 6000 ? text[..6000] + "…" : text);
            }
        }
        Flush();
        return new Notes(url, DateTimeOffset.UtcNow.ToString("O"), title, sections.Take(8).ToArray(), sections.Count == 0 ? "No recognizable release-note sections were available. Read the original page for the complete details." : null);
    }
}
