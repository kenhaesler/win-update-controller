import { readStored } from "./storage";
export type ThemePreference = "system" | "dark" | "light";
export function loadAppearance(): ThemePreference {
  const value = readStored("update-controller.theme");
  return value === "dark" || value === "light" ? value : "system";
}
