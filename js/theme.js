/** theme.js — reads CSS custom properties and toggles light/dark. */

/** Current value of a CSS custom property on :root, e.g. cssVar("--accent"). */
export const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const KEY = "mesfet-bench-theme";

/** Apply a saved theme preference, if the browser has one and allows storage. */
export function restoreTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch {
    /* private window, blocked storage — fall back to the OS preference */
  }
}

/** Flip between light and dark, and remember it. Returns the new theme. */
export function toggleTheme() {
  const root = document.documentElement;
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const current = root.getAttribute("data-theme") || (prefersDark ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore — the theme still applies for this page view */
  }
  return next;
}
