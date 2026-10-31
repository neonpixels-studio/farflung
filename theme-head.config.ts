import {
  PREFERS_DARK_QUERY,
  THEME_ATTR,
  THEME_STORAGE_KEY,
} from "./app/utils/theme";

// Runs before first paint so dark and system users don't get a flash of the
// light theme while waiting for hydration. Mirrors readStoredTheme/resolveTheme.
export const THEME_INIT_SCRIPT = `(function(){var s;try{s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}var d=s==="dark"||(s!=="light"&&window.matchMedia(${JSON.stringify(PREFERS_DARK_QUERY)}).matches);document.documentElement.setAttribute(${JSON.stringify(THEME_ATTR)},d?"dark":"light")})();`;
