import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  FileText,
  History,
  Info,
  LoaderCircle,
  Monitor,
  Moon,
  PackageOpen,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import {
  api,
  dateLabel,
  formatSize,
  policyLabel,
  preview,
  selectedAction,
  openControllerRelease,
} from "./api";
import { version as appVersion } from "../package.json";
import {
  loadPreferences,
  newerVersion,
  preferenceKey,
  type Preferences,
} from "./preferences";
import { demoScan } from "./demo";
import ReleaseNotes from "./ReleaseNotes";
import { loadScanCache, writeStored } from "./storage";
import { loadAppearance } from "./appearance";
import ErrorDetails from "./ErrorDetails";
import { discovered, identity, scanAge, sortUpdates, type SortOrder } from "./updateList";
import ReminderEditor from "./ReminderEditor";
import { dueReminders, loadReminders, localDay, reminderIdentity, reminderKey, type ReviewReminder } from "./reminders";
import OperationProgress from "./OperationProgress";
import { validProgress, type ProgressSnapshot } from "./progress";
import { loadPolicyAlerts, policyChange } from "./policyChanges";
import KnownIssueReview from "./KnownIssueReview";
import ActivityLog from "./ActivityLog";
import DriverExclusion from "./DriverExclusion";
import type {
  Category,
  HistoryResult,
  Operation,
  DriverRule,
  ScanResult,
  SystemStatus,
  Tab,
  UpdateReview,
} from "./types";

function Mark() {
  return (
    <span className="app-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
function PackageIcon({ category }: { category: Category }) {
  const Icon =
    category === "Security"
      ? Shield
      : category === "Drivers"
        ? Monitor
        : FileText;
  return (
    <Icon
      className={`package-icon ${category === "Security" ? "security-icon" : ""}`}
      size={28}
      strokeWidth={1.6}
    />
  );
}
function loadCache(): ScanResult | null {
  if (preview) return demoScan;
  return loadScanCache();
}

export default function App() {
  const [tab, setTab] = useState<Tab>("Updates");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const previousStatus = useRef<SystemStatus | null>(null);
  const policyMutation = useRef(false);
  const [policyAlerts, setPolicyAlerts] = useState(loadPolicyAlerts);
  const policyAlertsRef = useRef(policyAlerts);
  policyAlertsRef.current = policyAlerts;
  const [scan, setScan] = useState<ScanResult | null>(loadCache);
  const [reminders, setReminders] = useState(loadReminders);
  const [reminderDay, setReminderDay] = useState(localDay);
  const deliveredReminders = useRef(new Set<string>());
  const due = dueReminders(reminders, reminderDay);
  function saveReminder(update: { id: string; revision: number }, reminder: ReviewReminder | null) {
    const next = reminders.filter(r => reminderIdentity(r) !== reminderIdentity(update));
    if (reminder) next.push(reminder);
    try {
      localStorage.setItem(reminderKey, JSON.stringify(next));
      deliveredReminders.current.delete(reminderIdentity(update) + "." + (reminder?.reviewDate ?? ""));
      setReminders(next);
      setNotice(reminder ? "Review reminder saved. No update action was started." : "Review reminder removed.");
    } catch { setError("Could not save the reminder. Check available storage and try again."); }
  }
  useEffect(() => {
    const timer = setInterval(() => setReminderDay(localDay()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const notify = due.filter(r => !r.notified && !deliveredReminders.current.has(reminderIdentity(r) + "." + r.reviewDate));
    if (!notify.length) return;
    notify.forEach(r => deliveredReminders.current.add(reminderIdentity(r) + "." + r.reviewDate));
    const keys = new Set(notify.map(reminderIdentity));
    const next = reminders.map(r => keys.has(reminderIdentity(r)) ? { ...r, notified: true } : r);
    try { localStorage.setItem(reminderKey, JSON.stringify(next)); setReminders(next); } catch { /* Due reminders remain visible even without storage. */ }
    void api.notifyReviewDue(notify.length).catch(() => { /* The persistent in-app due list remains available. */ });
  }, [reminders, reminderDay]);
  const [activeId, setActiveId] = useState<string | null>(
    () => loadCache()?.updates[0]?.id ?? null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("default");
  const [cachedResults, setCachedResults] = useState(() => !preview && !!loadCache());
  const [newPackages, setNewPackages] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ report: ProgressSnapshot; receivedAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorContext, setErrorContext] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(loadPreferences);
  const [release, setRelease] = useState<string | null>(null);
  const [releaseStatus, setReleaseStatus] = useState("Not checked yet.");
  const [releaseBusy, setReleaseBusy] = useState(false);
  const started = useRef(false);
  const operationActive = useRef(false);
  const releaseActive = useRef(false);
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [driverRules, setDriverRules] = useState<DriverRule[]>([]);
  const [driverRulesError, setDriverRulesError] = useState<string | null>(null);
  useEffect(() => { void api.driverRules().then(rules => {
    setDriverRules(rules);
    setScan(current => current && ({ ...current, updates: current.updates.map(u => u.driver || u.category === "Drivers" ? {
      ...u, excluded: rules.length > 0 && (!u.driver?.hardwareId || rules.some(r => r.hardwareId.toUpperCase() === u.driver?.hardwareId?.toUpperCase())),
    } : u) }));
  }).catch(e => setDriverRulesError(String(e))); }, []);
  async function changeDriverRule(update?: UpdatePackage, ruleId?: string) {
    await run("Saving device exclusions…", async () => {
      setDriverRules(update ? await api.excludeDriver(update) : await api.removeDriverRule(ruleId!));
      setDriverRulesError(null);
      saveScan(await api.scan()); setSelected(new Set());
      setNotice(update ? "Device exclusion saved. Matching drivers cannot be downloaded or installed by the controller." : "Device exclusion removed. Windows-hidden packages remain hidden until you restore them.");
    });
  }
  async function checkUnresolved(operation: Operation) {
    await run("Checking unresolved packages…", async () => {
      const next = await api.scan();
      saveScan(next);
      setStatus(await api.status());
      const unresolved = operation.results.filter(r => r.result !== "Succeeded");
      const candidates = next.updates.filter(u => !u.hidden && unresolved.some(r => r.id === u.id && r.revision === u.revision) && (operation.action !== "download" || !u.downloaded));
      setSelected(new Set(candidates.map(u => u.id)));
      setActiveId(candidates[0]?.id ?? null); setFilter("All"); setQuery(""); setTab("Updates");
      setNotice(candidates.length ? `${candidates.length} unresolved packages are available. Review the new selection before continuing; nothing was downloaded or installed.` : "No unresolved exact package revisions are available for retry. Inspect Windows history; replacement packages require a separate selection.");
    });
  }
  function exportDiagnostics() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), status, history }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "update-controller-diagnostics.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const [review, setReview] = useState<UpdateReview | null>(null);
  const [policyReview, setPolicyReview] = useState<"enable" | "restore" | null>(
    null,
  );
  const [accepted, setAccepted] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [theme, setTheme] = useState(loadAppearance);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const resolvedTheme = theme === "system" ? systemDark ? "dark" : "light" : theme;
  const dialog = useRef<HTMLDialogElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const dialogInvoker = useRef<HTMLElement | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const packageButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusIntent = useRef<"detail" | "list" | null>(null);
  const reduceMotion = useReducedMotion();
  const packages = scan?.updates ?? [];
  const hiddenView = filter === "Hidden";
  const excludedView = filter === "Excluded";
  const visiblePackages = packages.filter((u) => hiddenView ? !!u.hidden : excludedView ? !!u.excluded && !u.hidden : !u.hidden && !u.excluded);
  const active = visiblePackages.find((u) => u.id === activeId);
  const selection = visiblePackages.filter((u) => selected.has(u.id));
  const action = selectedAction(selection);
  const filtered = sortUpdates(visiblePackages.filter(
    (u) =>
      (filter === "All" ||
        filter === "Hidden" ||
        (filter === "Downloaded" && u.downloaded) ||
        filter === "Excluded" ||
        u.category === filter ||
        (filter === "Optional" && u.category === "Drivers")) &&
      `${u.title} ${u.kbIds.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  ), sort);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    writeStored("update-controller.theme", theme);
  }, [theme, resolvedTheme]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const changed = () => setSystemDark(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (preferences.controllerUpdates) void checkController();
    if (preferences.startupScan) void check();
  }, []);
  function changePreference(key: keyof Preferences, value: boolean) {
    const next = { ...preferences, [key]: value };
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(next));
      setPreferences(next);
    } catch {
      setError("Could not save preferences. The setting was not changed.");
    }
  }
  async function checkController() {
    if (releaseActive.current) return;
    releaseActive.current = true;
    setReleaseBusy(true);
    setReleaseStatus("Checking GitHub releases…");
    try {
      const latest = await api.appRelease();
      const newer = newerVersion(latest.version, appVersion);
      setRelease(newer ? latest.version : null);
      setReleaseStatus(
        newer
          ? `Version ${latest.version} is available.`
          : `Version ${appVersion} is up to date.${preview ? " Preview only." : ""}`,
      );
    } catch (e) {
      setReleaseStatus(
        `Could not check controller updates: ${String(e)} Try again.`,
      );
    } finally {
      releaseActive.current = false;
      setReleaseBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    const read = () =>
      api
        .status()
        .then((s) => {
          if (alive) {
            const message = previousStatus.current && !policyMutation.current ? policyChange(previousStatus.current, s) : null;
            previousStatus.current = s;
            setStatus(s);
            if (message) {
              setNotice(message);
              if (policyAlertsRef.current) void api.notifyPolicyChange(message).catch(() => {
                if (alive) setNotice(message + " Windows notification delivery was unavailable; this alert remains in the controller.");
              });
            }
          }
        })
        .catch((e) => {
          if (alive) {
            setStatus(null);
            setError(String(e));
          }
        });
    void read();
    const timer = setInterval(read, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (tab !== "History") return;
    let alive = true;
    setHistoryError(null);
    api
      .history()
      .then((h) => {
        if (alive) setHistory(h);
      })
      .catch((e) => {
        if (alive) setHistoryError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [tab]);
  useEffect(() => {
    if (review || policyReview) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close();
      const invoker = dialogInvoker.current;
      if (invoker?.isConnected && !invoker.matches(":disabled"))
        invoker.focus();
      else
        document.querySelector<HTMLButtonElement>(".nav-item.active")?.focus();
    }
  }, [review, policyReview]);
  useEffect(() => {
    if (
      !focusIntent.current ||
      !window.matchMedia("(max-width: 800px)").matches
    )
      return;
    if (focusIntent.current === "detail") backRef.current?.focus();
    else if (activeId) packageButtons.current[activeId]?.focus();
    focusIntent.current = null;
  }, [showDetail, activeId]);
  useEffect(() => {
    if (preview) return;
    const unsub = import("@tauri-apps/api/event").then(({ listen }) =>
      listen("operation-active", () =>
        setNotice(
          "An update operation is running. You can close the window to keep it running in the tray.",
        ),
      ),
    );
    return () => {
      void unsub.then((fn) => fn());
    };
  }, []);
  useEffect(() => {
    if (preview) return;
    const unsub = import("@tauri-apps/api/event").then(({ listen }) => listen<unknown>("operation-progress", event => {
      if (operationActive.current && validProgress(event.payload)) setProgress({ report: event.payload, receivedAt: Date.now() });
    }));
    return () => { void unsub.then(fn => fn()); };
  }, []);
  async function run(label: string, work: () => Promise<void>) {
    if (operationActive.current) return;
    operationActive.current = true;
    setBusy(label);
    setErrorContext(label);
    setProgress(null);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (e) {
      setError(String(e));
    } finally {
      operationActive.current = false;
      setBusy(null);
      setProgress(null);
    }
  }
  function saveScan(next: ScanResult) {
    setScan(next);
    if (!preview) {
      try {
        localStorage.setItem("update-controller.scan.v1", JSON.stringify(next));
      } catch {
        /* A cache failure must not hide the live scan result. */
      }
    }
  }
  async function check() {
    await run("Checking for updates…", async () => {
      const result = await api.scan();
      setNewPackages(discovered(result.updates, packages));
      setCachedResults(false);
      setNow(Date.now());
      const available = result.updates.filter((u) => !u.hidden);
      saveScan(result);
      setSelected(new Set());
      setActiveId(result.updates[0]?.id ?? null);
      const currentStatus = await api.status();
      setStatus(currentStatus);
      const defender = available.filter((u) => u.autoInstallEligible === true);
      if (preferences.autoDefender && defender.length) {
        if (currentStatus.restartPending) {
          setNotice(
            "Defender automation skipped: Windows has a pending restart. Other updates remain available for review.",
          );
          return;
        }
        setBusy("Installing eligible Defender updates…");
        const result = await api.autoDefender(defender);
        setNotice(
          `Defender automation: ${result.message ?? result.state}${result.restartRequired ? " Windows reported an unexpected restart requirement; the controller will not restart your PC." : ""}`,
        );
        saveScan(await api.scan());
        setStatus(await api.status());
        setHistory(await api.history());
        return;
      }
      setNotice(
        available.length
          ? `Found ${available.length} available update${available.length === 1 ? "" : "s"}. Nothing was downloaded or installed.${preferences.autoDefender ? " No eligible Defender updates." : ""}`
          : "Windows reports no available updates.",
      );
    });
  }
  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function beginReview() {
    if (hiddenView || selection.some((u) => u.hidden || u.excluded)) return;
    dialogInvoker.current = document.activeElement as HTMLElement;
    await run("Preparing your selection…", async () => {
      setAccepted(false);
      setReview(
        await api.review(
          action === "download"
            ? selection.filter((u) => !u.downloaded)
            : selection,
          action,
        ),
      );
    });
  }
  async function changeHidden() {
    const hidden = !hiddenView;
    await run(
      hidden ? "Hiding selected updates…" : "Restoring hidden updates…",
      async () => {
        const result = await api.setHidden(selection, hidden);
        const succeeded = result.results.filter((r) => r.success);
        if (scan)
          saveScan({
            ...scan,
            updates: packages.map((u) =>
              succeeded.some((r) => r.id === u.id && r.revision === u.revision)
                ? { ...u, hidden }
                : u,
            ),
          });
        setSelected(new Set());
        setActiveId(null);
        setShowDetail(false);
        const failures = result.results.filter((r) => !r.success);
        setNotice(
          `${succeeded.length} update${succeeded.length === 1 ? "" : "s"} ${hidden ? "hidden" : "restored"}. Nothing was downloaded or installed.`,
        );
        if (failures.length)
          setError(
            failures
              .map(
                (r) =>
                  `${packages.find((u) => u.id === r.id)?.title ?? r.id}: ${r.error}`,
              )
              .join(" "),
          );
      },
    );
  }
  function openPolicyReview(kind: "enable" | "restore") {
    dialogInvoker.current = document.activeElement as HTMLElement;
    setPolicyReview(kind);
  }
  async function executeReview() {
    if (!review) return;
    const approved = review;
    setReview(null);
    await run(
      approved.action === "install"
        ? "Installing selected updates…"
        : "Downloading selected updates…",
      async () => {
        const result = await api.execute(approved, accepted);
        const succeeded = new Set(
          result.results
            .filter((x) => x.result === "Succeeded")
            .map((x) => x.id),
        );
        if (approved.action === "install") {
          const remaining = reminders.filter(r => !succeeded.has(r.id) || !approved.updates.some(u => reminderIdentity(u) === reminderIdentity(r)));
          setReminders(remaining);
          try { localStorage.setItem(reminderKey, JSON.stringify(remaining)); }
          catch { setError("The operation finished, but completed-package reminders could not be cleared from storage."); }
        }
        if (scan)
          saveScan({
            ...scan,
            updates:
              approved.action === "install"
                ? packages.filter((u) => !succeeded.has(u.id))
                : packages.map((u) =>
                    succeeded.has(u.id) ? { ...u, downloaded: true } : u,
                  ),
          });
        setSelected(new Set());
        setStatus(await api.status());
        setHistory(await api.history());
        setNotice(
          `${result.message || "Operation finished."}${result.restartRequired ? " A restart is required; the app will not restart your PC." : ""}`,
        );
        if (result.state !== "completed") setTab("History");
      },
    );
  }
  async function changePolicy() {
    const enable = policyReview === "enable";
    setPolicyReview(null);
    await run(
      enable ? "Configuring manual mode…" : "Restoring previous policy…",
      async () => {
        policyMutation.current = true;
        try {
          const updated = await api.policy(enable);
          previousStatus.current = updated;
          setStatus(updated);
        } finally { policyMutation.current = false; }
        setNotice(
          enable
            ? "Manual-mode policy saved. Check the status details for verification and any existing pending restart."
            : "Your previous policy value was restored.",
        );
      },
    );
  }

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="brand">
          <Mark />
          <span>Update Controller</span>
          {preview && (
            <span className="preview-label">INTERACTIVE PREVIEW</span>
          )}
        </div>
        <span className="titlebar-note">
          {preview
            ? "Sample data · No changes to your PC"
            : "Your updates. Your decision."}
        </span>
      </header>
      <section
        className="control-strip"
        aria-label="Windows update control status"
      >
        <div className="control-copy">
          <span
            className={`status-dot ${status?.manualConfigured && !status.conflicts.length ? "positive" : "warning"}`}
          />
          <strong>
            {preview && status?.manualConfigured
              ? "Manual control active"
              : policyLabel(status)}
          </strong>
          <span className="control-divider" />
          <span className="control-description">
            {status?.conflicts.length
              ? "Review the conflict in Settings."
              : status?.manualConfigured
                ? preview
                  ? preferences.autoDefender
                    ? "Defender automation enabled."
                    : "Updates wait for your approval."
                  : "Policy configured. Review verification in Settings."
                : status
                  ? "Enable manual mode in Settings."
                  : "Retry the status check in Settings."}
          </span>
        </div>
        <button className="button outline" onClick={check} disabled={!!busy}>
          <RefreshCw
            size={17}
            className={busy === "Checking for updates…" ? "spin" : ""}
          />
          {busy === "Checking for updates…" ? "Checking…" : "Check for updates"}
        </button>
      </section>
      <nav className="navigation" aria-label="Main navigation">
        {(["Updates", "History", "Settings"] as Tab[]).map((item) => {
          const Icon =
            item === "Updates"
              ? ArrowDownToLine
              : item === "History"
                ? Clock3
                : Settings;
          return (
            <button
              key={item}
              aria-current={tab === item ? "page" : undefined}
              className={tab === item ? "nav-item active" : "nav-item"}
              onClick={() => setTab(item)}
            >
              <Icon size={19} />
              {item}
            </button>
          );
        })}
        <button
          className="theme-button icon-button"
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </nav>
      {status?.restartPending && (
        <div className="banner warning-banner">
          <RefreshCw size={18} />
          <span>
            Windows already has a restart pending. Manual mode cannot undo an
            update staged for restart.
          </span>
        </div>
      )}
      {release && (
        <div className="banner notice-banner">
          <Download size={18} />
          <span>
            Update Controller {release} is available. You have {appVersion}.
          </span>
          <button
            className="button outline"
            onClick={() =>
              void openControllerRelease().catch((e) => setError(String(e)))
            }
          >
            View release
          </button>
        </div>
      )}
      {error && (
        <div className="banner error-banner" role="alert">
          <CircleAlert size={18} />
          <ErrorDetails error={error} context={errorContext} busy={!!busy}
            recover={(action) => {
              if (action === "settings") { setTab("Settings"); return; }
              if (action === "scan") { setTab("Updates"); void check(); return; }
              void run("Reading control status…", async () => {
                setStatus(await api.status());
                if (action === "history") { setTab("History"); setHistory(await api.history()); setHistoryError(null); }
              });
            }} />
          <button
            className="icon-button"
            aria-label="Dismiss error"
            onClick={() => setError(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="banner notice-banner" role="status">
          <Info size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {due.length > 0 && <div className="banner reminder-banner">
        <Clock3 size={18} /><details><summary>{due.length} update reminder{due.length === 1 ? "" : "s"} due for review</summary>
          <ul>{due.map(r => <li key={reminderIdentity(r)}>
            <strong>{r.title}</strong> · {r.reviewDate}{r.reason && <p>{r.reason}</p>}
            {packages.some(u => reminderIdentity(u) === reminderIdentity(r)) ?
              <button className="text-link" onClick={() => { setTab("Updates"); setFilter(packages.find(u => u.id === r.id)?.hidden ? "Hidden" : "All"); setActiveId(r.id); setShowDetail(true); }}>Review package</button> :
              <p className="muted">Check for updates to see whether this package is still available.</p>}
            <button className="text-link" onClick={() => saveReminder(r, null)}>Dismiss reminder for {r.title}</button>
          </li>)}</ul></details>
      </div>}
      {busy && (
        <div className="operation-banner" role="status" aria-live="polite">
          <LoaderCircle size={17} className="spin" />
          <span>{busy}</span>
          {progress && <OperationProgress report={progress.report} receivedAt={progress.receivedAt} />}
          <span className="muted">
            {busy.startsWith("Installing")
              ? "Windows is working. You can keep using your PC."
              : "This can take a few minutes."}
          </span>
        </div>
      )}
      <main className="workspace">
        {tab === "Updates" && (
          <div className={`updates-view ${showDetail ? "show-detail" : ""}`}>
            <section
              className="package-pane"
              aria-label={hiddenView ? "Hidden updates" : "Available updates"}
            >
              <div className="list-heading">
                <div className="heading-line">
                  <h1>{hiddenView ? "Hidden updates" : "Available updates"}</h1>
                  <span className="count">{visiblePackages.length}</span>
                </div>
                <p className="muted">
                  {preview
                    ? "Sample packages for exploring the interface"
                    : scan
                      ? `${cachedResults ? "Cached results" : "Last checked"} · ${scanAge(scan.checkedAt, now)} · ${dateLabel(scan.checkedAt)}`
                      : "Check to see what’s available for your PC"}
                </p>
              </div>
              <div className="filters" aria-label="Filter updates">
                {["All", "Security", "Drivers", "Optional", "Downloaded", "Excluded", "Hidden"].map(
                  (f) => (
                    <button
                      key={f}
                      className={`filter ${filter === f ? "selected" : ""}`}
                      aria-pressed={filter === f}
                      disabled={!!busy}
                      onClick={() => {
                        setFilter(f);
                        setSelected(new Set());
                        setActiveId(null);
                      }}
                    >
                      {f}
                    </button>
                  ),
                )}
              </div>
              <label className="sort-control">Sort updates
                <select aria-label="Sort updates" value={sort} disabled={!!busy}
                  onChange={e => setSort(e.target.value as SortOrder)}>
                  <option value="default">Windows order</option>
                  <option value="newest">Newest first</option>
                  <option value="size">Smallest download first</option>
                  <option value="restart">Restart required first</option>
                </select>
              </label>
              {packages.length > 5 && (
                <label className="search">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search updates or KB number"
                    aria-label="Search updates"
                  />
                </label>
              )}
              <div className="selection-tools" aria-label="Package selection tools">
                <button className="text-link" disabled={!!busy || !filtered.length}
                  onClick={() => setSelected(new Set(filtered.map(u => u.id)))}>
                  Select visible ({filtered.length})
                </button>
                {!hiddenView && <button className="text-link"
                  disabled={!!busy || !filtered.some(u => u.downloaded)}
                  onClick={() => setSelected(new Set(filtered.filter(u => u.downloaded).map(u => u.id)))}>
                  Select downloaded ({filtered.filter(u => u.downloaded).length})
                </button>}
                <span className="muted">Replaces selection with matches in this view.</span>
              </div>
              <div className="package-list">
                {filtered.map((u) => (
                  <div
                    key={u.id}
                    className={`package-row ${activeId === u.id ? "reading" : ""}`}
                  >
                    <input
                      className="package-checkbox"
                      type="checkbox"
                      checked={selected.has(u.id)}
                      aria-label={`Select ${u.title}`}
                      onChange={() => toggle(u.id)}
                      disabled={!!busy || !!u.excluded}
                    />
                    <button
                      ref={(el) => {
                        packageButtons.current[u.id] = el;
                      }}
                      className="package-open"
                      onClick={() => {
                        setActiveId(u.id);
                        focusIntent.current = "detail";
                        setShowDetail(true);
                      }}
                      aria-label={`Read about ${u.title}`}
                      aria-pressed={activeId === u.id}
                    >
                      <PackageIcon category={u.category} />
                      <span className="package-copy">
                        <span className="package-title">{u.title}{newPackages.has(identity(u)) && <span className="new-update" aria-label="New since previous check"> · New</span>}</span>
                        <span className="package-subtitle">
                          {u.kbIds.length
                            ? u.kbIds.map((kb) => `KB${kb}`).join(", ")
                            : u.category === "Security"
                              ? "Windows 11 · Cumulative update"
                              : u.category === "Drivers"
                                ? "Driver update"
                              : "Stability and performance"}
                          {u.downloaded ? " · Ready to install" : " · Not downloaded"}
                        </span>
                      </span>
                      <span className="package-meta">
                        <span className={`badge ${u.category.toLowerCase()}`}>
                          {u.category === "Drivers" ? "Optional" : u.category}
                        </span>
                        <span className="small-status">
                          {u.downloaded ? (
                            <>
                              <Check size={13} />
                              Downloaded
                            </>
                          ) : u.restart !== "Not expected" ? (
                            <>
                              <CircleAlert size={13} />
                              Restart possible
                            </>
                          ) : (
                            formatSize(u.size)
                          )}
                        </span>
                      </span>
                    </button>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="empty-state">
                    <PackageOpen size={34} strokeWidth={1.3} />
                    <h2>
                      {hiddenView
                        ? "No hidden updates"
                        : visiblePackages.length
                          ? "No matching updates"
                          : scan
                            ? "You’re all caught up"
                            : "Start with a check"}
                    </h2>
                    <p>
                      {hiddenView
                        ? "Hidden updates appear here after a check. Restore them whenever you want."
                        : visiblePackages.length
                          ? "Try another filter or search term."
                          : scan
                            ? "Windows reports no available packages from the last check."
                            : preferences.autoDefender
                              ? "Check for available packages. Eligible Defender updates will be installed automatically."
                              : "See available packages and read what they change. Nothing installs when you check."}
                    </p>
                    {!scan && (
                      <button
                        className="button outline"
                        disabled={!!busy}
                        onClick={check}
                      >
                        Check for updates
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="list-footnote">
                <Info size={15} />
                <span>
                  Hide selected updates to keep them out of future checks and
                  installations. Restore them under Hidden. New replacement
                  updates may still appear. Windows may request administrator
                  access.
                </span>
              </div>
            </section>
            <section className="detail-pane" aria-label="Update details">
              <button
                ref={backRef}
                className="back-button"
                onClick={() => {
                  focusIntent.current = "list";
                  setShowDetail(false);
                }}
              >
                <ArrowLeft size={16} />
                All updates
              </button>
              <AnimatePresence mode="wait" initial={false}>
                {active ? (
                  <motion.article
                    key={active.id}
                    className="update-article"
                    initial={{ opacity: 0.8, y: reduceMotion ? 0 : 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0.8 }}
                    transition={{ duration: reduceMotion ? 0 : 0.15 }}
                  >
                    <p className="detail-kicker">
                      {active.category === "Drivers"
                        ? "DEVICE DRIVER"
                        : "WINDOWS 11"}
                      <span>/</span>
                      {active.category.toUpperCase()}
                    </p>
                    <h2 className="detail-title">{active.title}</h2>
                    <p className="detail-meta">
                      {preview ? "Example package" : dateLabel(active.date)}
                      <span>·</span>
                      {active.downloaded
                        ? "Downloaded · Ready to install"
                        : "Not installed"}
                      {active.size > 0 && (
                        <>
                          <span>·</span>
                          {formatSize(active.size)}
                        </>
                      )}
                    </p>
                    <section className="detail-section">
                      <div className="section-heading">
                        <h3>What changes</h3>
                        <span>
                          {preview
                            ? "Illustrative summary"
                            : "From Windows Update"}
                        </span>
                      </div>
                      <p className="description">
                        {active.description ||
                          "The publisher did not provide a description for this package. Check the official release notes before deciding."}
                      </p>
                    </section>
                    <section className="detail-section">
                      <h3>Before you install</h3>
                      <div className="restart-detail">
                        <RefreshCw size={25} strokeWidth={1.6} />
                        <div>
                          <p>
                            {active.restart === "Not expected"
                              ? "A restart is not expected"
                              : active.restart === "Required"
                                ? "A restart is required"
                                : "A restart may be required"}
                          </p>
                          <p className="muted">
                            The app will not restart your PC automatically.
                          </p>
                        </div>
                      </div>
                      {active.exclusive && (
                        <p className="inline-warning">
                          This package must be installed on its own.
                        </p>
                      )}
                      {active.bundles.length > 0 && (
                        <details>
                          <summary>
                            Included components ({active.bundles.length})
                          </summary>
                          <ul className="bundle-list">
                            {active.bundles.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </section>
                    <ReleaseNotes key={active.id} update={active} />
                    <ReminderEditor key={reminderIdentity(active) + (reminders.find(r => reminderIdentity(r) === reminderIdentity(active))?.reviewDate ?? "")}
                      update={active} reminder={reminders.find(r => reminderIdentity(r) === reminderIdentity(active))}
                      save={reminder => saveReminder(active, reminder)} />
                    {active.excluded && active.category !== "Drivers" && <p className="inline-warning">This package includes an excluded driver. Review device exclusions in Settings.</p>}
                    {active.category === "Drivers" && <DriverExclusion key={`driver.${active.id}.${active.revision}`} update={active} busy={!!busy} exclude={() => void changeDriverRule(active)} />}
                  </motion.article>
                ) : (
                  <div className="empty-state reader-empty">
                    <FileText size={38} strokeWidth={1.2} />
                    <h2>Know what you’re installing</h2>
                    <p>
                      Select an update to read its description, restart
                      requirements, and official notes.
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </section>
          </div>
        )}
        {tab === "History" && (
          <section className="page history-page">
            <div className="page-heading">
              <div>
                <h1>Update history</h1>
                <p className="muted">
                  Installation results reported by Windows.
                </p>
              </div>
              <button
                className="button outline"
                disabled={!!busy}
                onClick={() =>
                  run("Reading update history…", async () => {
                    setHistory(await api.history());
                    setHistoryError(null);
                  })
                }
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
            {history && <div className="history-tools"><label>Search history<input aria-label="Search history" value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} placeholder="Package, action, outcome or error code" /></label>
              <button className="button outline" onClick={exportDiagnostics}>Export diagnostics</button></div>}
            {history?.operations && <ActivityLog operations={history.operations} query={historyQuery} busy={!!busy} retry={operation => void checkUnresolved(operation)} />}
            {history?.lastOperation && !history.operations?.length && (
              <div className="operation-summary">
                <h2>Last app operation</h2>
                <p>
                  {history.lastOperation.action} · {history.lastOperation.state}{" "}
                  · {dateLabel(history.lastOperation.startedAt)}
                </p>
                {history.lastOperation.message && (
                  <p className="muted">{history.lastOperation.message}</p>
                )}
                {history.lastOperation.state === "running" && (
                  <p className="inline-warning">
                    The last recorded operation was running. Its completion is
                    not confirmed. Check Windows history before retrying.
                  </p>
                )}
                {history.lastOperation.results.map((r) => (
                  <div key={r.id} className="operation-result">
                    <span>{r.title}</span>
                    <span>
                      {r.result} {r.code}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {historyError ? (
              <div className="empty-state">
                <CircleAlert size={30} />
                <h2>Couldn’t read update history</h2>
                <ErrorDetails error={historyError} />
                <button
                  className="button outline"
                  disabled={!!busy}
                  onClick={() =>
                    run("Reading update history…", async () => {
                      const result = await api.history();
                      setHistory(result);
                      setHistoryError(null);
                    })
                  }
                >
                  Try again
                </button>
              </div>
            ) : history === null ? (
              <div className="empty-state">
                <LoaderCircle className="spin" />
                Reading history…
              </div>
            ) : history.entries.length === 0 ? (
              <div className="empty-state">
                <History size={36} />
                <h2>No installation history yet</h2>
                <p>
                  {preview
                    ? "Try downloading and installing a sample package to explore this screen."
                    : "Windows has no recent installation entries to show."}
                </p>
              </div>
            ) : (
              <div className="history-list">
                {history.entries.filter(entry => `${entry.title} ${entry.action} ${entry.result} ${entry.code} ${entry.client}`.toLowerCase().includes(historyQuery.toLowerCase())).map((entry, i) => (
                  <div className="history-row" key={`${entry.date}-${i}`}>
                    {entry.result === "Succeeded" ? (
                      <CheckCircle2 className="positive-text" size={20} />
                    ) : (
                      <CircleAlert className="warning-text" size={20} />
                    )}
                    <div>
                      <h3>{entry.title}</h3>
                      <p className="muted">
                        {entry.action} · {dateLabel(entry.date)} ·{" "}
                        {entry.client || "Windows Update"}
                      </p>
                    </div>
                    <div className="history-outcome">
                      <span>{entry.result}</span>
                      <small>{entry.code}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {tab === "Settings" && (
          <section className="page settings-page">
            <div className="page-heading">
              <div>
                <h1>You decide when</h1>
                <p className="muted">
                  Control automatic installation without disabling Windows
                  servicing.
                </p>
              </div>
              <ShieldCheck
                size={32}
                className="accent-text"
                strokeWidth={1.5}
              />
            </div>
            <div className="setting-row">
              <div>
                <h2>Manual update mode</h2>
                <p>Configure Windows to wait for deliberate installation.</p>
                <p className="setting-state">{policyLabel(status)}</p>
              </div>
              <button
                ref={tab === "Settings" ? actionRef : undefined}
                className="button primary"
                disabled={
                  !!busy ||
                  !status?.supported ||
                  !!status.conflicts.length ||
                  status.manualConfigured
                }
                onClick={() => openPolicyReview("enable")}
              >
                {status?.manualConfigured ? (
                  <>
                    <Check size={16} />
                    Configured
                  </>
                ) : (
                  "Enable manual mode"
                )}
              </button>
            </div>
            <div className="setting-row">
              <div>
                <h2>Restore previous policy</h2>
                <p>
                  Restore the value saved before this app enabled manual mode.
                </p>
              </div>
              <button
                className="button outline"
                disabled={!!busy || !status?.canRestore}
                onClick={() => openPolicyReview("restore")}
              >
                Restore previous policy
              </button>
            </div>
            <div className="setting-row">
              <div>
                <h2>Check Windows updates on startup</h2>
                <p id="startup-help">
                  Check each time you open the controller. Installation follows
                  your Defender preference below; other updates wait for your
                  selection.
                </p>
              </div>
              <input
                type="checkbox"
                className="package-checkbox"
                aria-label="Check Windows updates on startup"
                aria-describedby="startup-help"
                checked={preferences.startupScan}
                disabled={!!busy}
                onChange={(e) =>
                  changePreference("startupScan", e.target.checked)
                }
              />
            </div>
            <div className="setting-row">
              <div>
                <h2>Automatically install Defender updates</h2>
                <p id="defender-help">
                  After each Windows update check, download and install eligible
                  Defender security intelligence and platform updates that
                  report no restart requirement. Runs only while the controller
                  is open. Administrator approval may appear.
                </p>
                <p>
                  Hidden updates, pending restarts, unaccepted licenses, and
                  packages with uncertain restart behavior are skipped. Enable
                  startup checks above to run this when the controller opens.
                </p>
              </div>
              <input
                type="checkbox"
                className="package-checkbox"
                aria-label="Automatically install Defender updates"
                aria-describedby="defender-help"
                checked={preferences.autoDefender}
                disabled={!!busy}
                onChange={(e) =>
                  changePreference("autoDefender", e.target.checked)
                }
              />
            </div>
            <div className="setting-row">
              <div>
                <h2>Check for controller updates</h2>
                <p id="controller-help">
                  Check GitHub for a newer version when the controller opens.
                  You choose whether to download and install it.
                </p>
                <p className="setting-state">
                  Installed: {appVersion}. {releaseStatus}
                </p>
                <button
                  className="text-link"
                  disabled={releaseBusy}
                  onClick={() => void checkController()}
                >
                  {releaseBusy
                    ? "Checking controller…"
                    : "Check controller now"}
                </button>
              </div>
              <input
                type="checkbox"
                className="package-checkbox"
                aria-label="Check for controller updates"
                aria-describedby="controller-help"
                checked={preferences.controllerUpdates}
                onChange={(e) =>
                  changePreference("controllerUpdates", e.target.checked)
                }
              />
            </div>
            <div className="setting-row">
              <div>
                <h2>Appearance</h2>
                <p>A comfortable reading surface, day or night.</p>
              </div>
              <div className="theme-options">
                <button className={`filter ${theme === "system" ? "selected" : ""}`}
                  aria-pressed={theme === "system"} onClick={() => setTheme("system")}>
                  <Monitor size={15} /> System
                </button>
                <button
                  className={`filter ${theme === "dark" ? "selected" : ""}`}
                  aria-pressed={theme === "dark"}
                  onClick={() => setTheme("dark")}
                >
                  <Moon size={15} />
                  Dark
                </button>
                <button
                  className={`filter ${theme === "light" ? "selected" : ""}`}
                  aria-pressed={theme === "light"}
                  onClick={() => setTheme("light")}
                >
                  <Sun size={15} />
                  Light
                </button>
              </div>
            </div>
            <div className="setting-row">
              <div><h2>Notify when update control changes</h2>
                <p id="policy-alert-help">Show Windows notifications when manual mode, management conflicts or the Update Agent change outside the controller. Checks run once a minute while the app is open. Changes also appear inside the app.</p></div>
              <input type="checkbox" className="package-checkbox" aria-label="Notify when update control changes"
                aria-describedby="policy-alert-help" checked={policyAlerts}
                onChange={e => {
                  try { localStorage.setItem("update-controller.policy-alerts", String(e.target.checked)); setPolicyAlerts(e.target.checked); }
                  catch { setError("Could not save notification preference. The setting was not changed."); }
                }} />
            </div>
            <section className="settings-detail">
              <h2>What the app can confirm</h2>
              <button
                className="text-link"
                disabled={!!busy}
                onClick={() =>
                  run("Reading control status…", async () => {
                    setStatus(await api.status());
                  })
                }
              >
                <RefreshCw size={15} />
                Refresh status
              </button>
              <dl>
                <div>
                  <dt>Windows version</dt>
                  <dd>
                    {status
                      ? `Windows 11 ${status.edition === "Professional" ? "Pro" : status.edition} ${status.version} · Build ${status.build}`
                      : "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Manual policy</dt>
                  <dd>
                    {status
                      ? status.manualConfigured
                        ? "Configured"
                        : "Not configured"
                      : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt>Automatic Update Agent</dt>
                  <dd>
                    {status?.agentDisabled === null || !status
                      ? "Could not read state"
                      : status.agentDisabled
                        ? "Reports automatic updates disabled"
                        : "Reports automatic updates enabled"}
                  </dd>
                </div>
                <div>
                  <dt>Pending restart</dt>
                  <dd>
                    {status
                      ? status.restartPending
                        ? "Windows reports a pending restart"
                        : "No pending restart reported"
                      : "Unknown"}
                  </dd>
                </div>
              </dl>
              <p className="muted">{status?.verification}</p>
              {status?.conflicts.map((c) => (
                <p className="inline-warning" key={c}>
                  {c}
                </p>
              ))}
            </section>
            <section className="settings-detail">
              <h2>Scope & limits</h2>
              <h3>Device driver exclusions</h3>
              <p className="muted">Rules block matching controller downloads and installations, including bundled drivers. Unknown driver identities are blocked while any rule is active. Removing a rule does not restore Windows-hidden packages.</p>
              {driverRulesError && <p className="inline-warning">Could not read driver exclusions: {driverRulesError}</p>}
              <button className="text-link" disabled={!!busy} onClick={() => void api.driverRules().then(rules => { setDriverRules(rules); setDriverRulesError(null); }).catch(e => setDriverRulesError(String(e)))}>Refresh driver exclusions</button>
              {!driverRulesError && driverRules.length === 0 && <p className="muted">No device driver exclusions saved.</p>}
              {driverRules.map(rule => <div key={rule.id} className="driver-rule"><div><strong>{rule.label}</strong><p className="driver-id">{rule.hardwareId}</p></div>
                <button className="button outline" disabled={!!busy} onClick={() => void changeDriverRule(undefined, rule.id)}>Remove exclusion for {rule.label}</button></div>)}
              <p className="muted">
                Manual mode cannot undo updates already staged for a restart.
                Cumulative fixes are selected as a package. Store apps,
                third-party updaters, and independent firmware tools have
                separate controls. Defender intelligence can use separate update
                paths.
              </p>
              <p className="muted">
                Policy changes remain when the app is closed or removed. Restore
                your previous policy here before uninstalling if you want
                Windows to manage updates again.
              </p>
            </section>
          </section>
        )}
      </main>
      {tab === "Updates" && (
        <section className="action-bar" aria-label="Selected update actions">
          <div>
            <strong>
              {selection.length
                ? `${selection.length} update${selection.length === 1 ? "" : "s"} selected`
                : "No updates selected"}
            </strong>
            {selection.some(u => !filtered.some(match => match.id === u.id)) &&
              <p className="muted">{selection.filter(u => !filtered.some(match => match.id === u.id)).length} selected outside the search results</p>}
            {selection.length > 0 && (
              <button
                className="clear-selection"
                disabled={!!busy}
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </button>
            )}
          </div>
          <div className="action-right">
            <button
              className="button outline"
              disabled={!selection.length || !!busy}
              onClick={changeHidden}
            >
              {hiddenView ? "Restore selected" : "Hide selected"}
            </button>
            <span className="muted action-hint">
              {hiddenView
                ? "Restore to make updates available again"
                : selection.length
                  ? action === "install"
                    ? "Review before installing"
                    : "Installation is a separate step"
                  : "Select a checkbox to download"}
            </span>
            {!hiddenView && (
              <button
                ref={actionRef}
                className={`button ${selection.length ? "primary" : "outline"}`}
                disabled={!selection.length || !!busy}
                onClick={beginReview}
              >
                {action === "download" ? (
                  <Download size={17} />
                ) : (
                  <ShieldCheck size={17} />
                )}{" "}
                {action === "download"
                  ? "Download selected"
                  : "Review installation"}
              </button>
            )}
          </div>
        </section>
      )}
      <footer className="system-footer">
        <span>
          <Mark />
          {status
            ? `Windows 11 ${status.edition === "Professional" ? "Pro" : status.edition}`
            : "Reading Windows status…"}
          <span className="footer-dot">·</span>
          {preview
            ? "Preview only"
            : status?.manualConfigured
              ? "Policy configured"
              : status
                ? "Manual mode off"
                : "Status unavailable"}
        </span>
        <span>
          <ShieldCheck size={15} />
          {preview
            ? "Sample data · No system changes"
            : "No automatic restarts"}
          <span className="footer-version">v{appVersion}</span>
        </span>
      </footer>
      <dialog
        ref={dialog}
        className="review-dialog"
        onCancel={() => {
          setReview(null);
          setPolicyReview(null);
        }}
        aria-labelledby="review-title"
      >
        <div className="dialog-top">
          <h2 id="review-title">
            {policyReview
              ? policyReview === "enable"
                ? "Enable manual mode"
                : "Restore previous policy"
              : review?.action === "install"
                ? "Review installation"
                : "Review download"}
          </h2>
          <button
            className="icon-button"
            aria-label="Close review"
            onClick={() => {
              setReview(null);
              setPolicyReview(null);
            }}
          >
            <X size={20} />
          </button>
        </div>
        {policyReview ? (
          <>
            <p>
              {policyReview === "enable"
                ? "The app will save the current automatic-update policy, then configure manual installation. Windows will request administrator access."
                : "The app will restore its saved policy value, provided it has not been changed by another tool. Windows will request administrator access."}
            </p>
            <div className="dialog-info">
              <Info size={19} />
              <p>
                This does not cancel a restart already pending. Policy readback
                is checked; behavior across future Windows builds cannot be
                guaranteed.
              </p>
            </div>
          </>
        ) : (
          review && (
            <>
              <p>
                {review.action === "install"
                  ? "Only these packages and their listed components will be submitted to Windows. Your PC will not restart automatically."
                  : "Download these packages now. They will wait for a separate installation action."}
              </p>
              <ul className="review-packages">
                {review.updates.map((u) => (
                  <li key={u.id}>
                    <PackageIcon category={u.category} />
                    <div>
                      <strong>{u.title}</strong>
                      <p>
                        {formatSize(u.size)} · Restart:{" "}
                        {u.restart.toLowerCase()}
                      </p>
                      {u.bundles.length > 0 && (
                        <details>
                          <summary>Included components</summary>
                          <ul>
                            {u.bundles.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {review.action === "install" && <KnownIssueReview updates={review.updates} version={status?.version} />}
              {review.licenses.map((license, i) => (
                <details className="license" key={i}>
                  <summary>License terms: {license.title}</summary>
                  <pre>
                    {license.text ||
                      "License text unavailable. Cancel and review this update in Windows Settings."}
                  </pre>
                </details>
              ))}
              {review.licenses.length > 0 && (
                <label className="accept-license">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  I accept the displayed license terms.
                </label>
              )}
            </>
          )
        )}
        {preview && (
          <p className="preview-callout">
            Preview only. This action simulates the flow without changing your
            PC.
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button outline"
            onClick={() => {
              setReview(null);
              setPolicyReview(null);
            }}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={
              !!review &&
              review.licenses.length > 0 &&
              (!accepted || review.licenses.some((l) => !l.text))
            }
            onClick={policyReview ? changePolicy : executeReview}
          >
            {policyReview
              ? "Apply policy change"
              : review?.action === "install"
                ? "Install these updates"
                : "Download these updates"}
            <ChevronRight size={16} />
          </button>
        </div>
      </dialog>
    </div>
  );
}
