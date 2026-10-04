export interface Preferences {
  controllerUpdates: boolean;
  startupScan: boolean;
  autoDefender: boolean;
}
export const preferenceKey = "update-controller.preferences.v1";
export function loadPreferences(): Preferences {
  const defaults = {
    controllerUpdates: true,
    startupScan: false,
    autoDefender: false,
  };
  try {
    const value = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}");
    for (const key of Object.keys(defaults) as (keyof Preferences)[])
      if (typeof value?.[key] === "boolean") defaults[key] = value[key];
  } catch {
    /* Fall back to safe defaults for unavailable or corrupt storage. */
  }
  return defaults;
}
export function newerVersion(latest: string, current: string): boolean {
  const parse = (value: string, allowPrerelease = false) => {
    const match =
      /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[\w.-]+)?$/.exec(value);
    if (!match || (match[4] && (!allowPrerelease || match[4].split(".").some(part => /^0\d+$/.test(part)))))
      throw new Error("The release has an unsupported version tag.");
    return { parts: match.slice(1, 4).map(BigInt), prerelease: !!match[4] };
  };
  const next = parse(latest),
    installed = parse(current, true);
  for (let i = 0; i < 3; i++) {
    if (next.parts[i] !== installed.parts[i]) return next.parts[i] > installed.parts[i];
  }
  return installed.prerelease;
}
