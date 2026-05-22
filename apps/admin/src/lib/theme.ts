import { browser } from "$app/environment";
import { writable } from "svelte/store";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "partygame.theme";

function readStoredTheme(): ThemeMode {
  if (!browser) return "system";
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (!browser) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const themeMode = writable<ThemeMode>(readStoredTheme());
export const resolvedTheme = writable<"light" | "dark">(resolveTheme(readStoredTheme()));

export function setThemeMode(mode: ThemeMode) {
  themeMode.set(mode);
  if (browser) {
    localStorage.setItem(STORAGE_KEY, mode);
    applyThemeToDocument(mode);
  }
}

export function applyThemeToDocument(mode: ThemeMode) {
  if (!browser) return;

  const resolved = resolveTheme(mode);
  resolvedTheme.set(resolved);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      "content",
      resolved === "light" ? "#f4f7fc" : "#070b14",
    );
  }
}

export function initTheme() {
  if (!browser) return;

  const mode = readStoredTheme();
  themeMode.set(mode);
  applyThemeToDocument(mode);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readStoredTheme() === "system") {
      applyThemeToDocument("system");
    }
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
