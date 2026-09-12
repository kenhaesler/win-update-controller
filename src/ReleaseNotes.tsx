import { useEffect, useState } from "react";
import { ArrowUpRight, FileText, LoaderCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { dateLabel, officialLink, openOfficial, preview } from "./api";
import type { UpdatePackage } from "./types";

interface Notes {
  source: string;
  retrievedAt: string;
  title: string;
  sections: { heading: string; text: string }[];
  unavailableReason: string | null;
}
export default function ReleaseNotes({ update }: { update: UpdatePackage }) {
  const [notes, setNotes] = useState<Notes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = `update-controller.notes.${update.id}.${update.revision}`;
  const links = update.supportUrls.filter(officialLink);
  useEffect(() => {
    setNotes(null);
    setError(null);
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const value = JSON.parse(saved);
        if (Array.isArray(value.sections) && officialLink(value.source))
          setNotes(value);
      }
    } catch {
      /* Cached sources are optional. */
    }
  }, [cacheKey]);
  async function fetchNotes() {
    if (!links[0] || preview) return;
    setLoading(true);
    setError(null);
    try {
      const next = await invoke<Notes>("windows_request", {
        request: { command: "notes", url: links[0], kbIds: update.kbIds },
      });
      setNotes(next);
      localStorage.setItem(cacheKey, JSON.stringify(next));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  async function open(url: string) {
    try {
      await openOfficial(url);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <section className="detail-section release-notes">
      <h3>Known issues & release notes</h3>
      {!notes && (
        <p className="muted">
          Known issues aren’t included in Windows Update metadata. Read the
          official notes for this package.
        </p>
      )}
      {notes && (
        <>
          <p className="notes-source">
            Source checked {dateLabel(notes.retrievedAt)} · Cached copy
          </p>
          {notes.unavailableReason && (
            <p className="muted">{notes.unavailableReason}</p>
          )}
          {notes.sections.map((section, i) => (
            <details className="notes-section" key={i}>
              <summary>{section.heading}</summary>
              <p>{section.text}</p>
            </details>
          ))}
          {!notes.sections.some((s) => /known issues/i.test(s.heading)) &&
            !notes.unavailableReason && (
              <p className="muted">
                No known-issue section was found. This does not mean the update
                has no known issues.
              </p>
            )}
        </>
      )}
      {!preview && links.length > 0 && (
        <button className="text-link" onClick={fetchNotes} disabled={loading}>
          {loading ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <FileText size={16} />
          )}{" "}
          {loading
            ? "Reading official notes…"
            : notes
              ? "Refresh notes"
              : "Load official notes here"}
        </button>
      )}
      {links.slice(0, 3).map((url, i) => (
        <button key={url} className="text-link" onClick={() => open(url)}>
          {i === 0
            ? "Read official release notes"
            : "More information from Microsoft"}
          <ArrowUpRight size={17} />
        </button>
      ))}
      {links.length === 0 && (
        <p className="source-unavailable">
          The publisher did not provide an official Microsoft link.
        </p>
      )}
      {error && (
        <p className="inline-warning" role="status">
          {error} You can still read the publisher’s description above.
        </p>
      )}
    </section>
  );
}
