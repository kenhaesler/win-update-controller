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
  const parse = (value: string) => {
    const match =
      /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[\w.-]+)?$/.exec(value);
    if (!match) throw new Error("The release has an unsupported version tag.");
    return match.slice(1, 4).map(BigInt);
  };
  const next = parse(latest),
    installed = parse(current);
  for (let i = 0; i < 3; i++) {
    if (next[i] !== installed[i]) return next[i] > installed[i];
  }
  return false;
}
