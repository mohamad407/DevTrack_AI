/**
 * disableInspect
 * ----------------
 * Blocks the right-click context menu and common DevTools / view-source
 * keyboard shortcuts as a casual deterrent.
 *
 * IMPORTANT: this is NOT security. It only stops the obvious mouse/keyboard
 * paths in a normal desktop browser. Anyone can still open DevTools from the
 * browser's own menu, use a different browser, use mobile DevTools, or
 * disable JavaScript before the page loads. Never rely on this to protect
 * secrets, API keys, or business logic — those must stay server-side.
 */
export function disableInspect() {
  const blockContextMenu = (e) => e.preventDefault();

  const blockKeys = (e) => {
    const key = e.key?.toUpperCase();

    // F12
    if (key === 'F12') {
      e.preventDefault();
      return;
    }

    // Ctrl/Cmd + Shift + I / J / C  (DevTools, Console, Inspect Element)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(key)) {
      e.preventDefault();
      return;
    }

    // Ctrl/Cmd + U (view source)
    if ((e.ctrlKey || e.metaKey) && key === 'U') {
      e.preventDefault();
      return;
    }

    // Ctrl/Cmd + S (save page)
    if ((e.ctrlKey || e.metaKey) && key === 'S') {
      e.preventDefault();
      return;
    }
  };

  document.addEventListener('contextmenu', blockContextMenu);
  document.addEventListener('keydown', blockKeys);

  // Return a cleanup function in case a component wants to remove the listeners
  return () => {
    document.removeEventListener('contextmenu', blockContextMenu);
    document.removeEventListener('keydown', blockKeys);
  };
}

/**
 * guardAgainstDevTools
 * ---------------------
 * Repeatedly hits a `debugger;` statement. If DevTools is closed this is a
 * no-op (runs in under a millisecond). If DevTools is open, the browser
 * actually pauses there, which freezes the whole page (no clicks, no
 * animations) until DevTools is closed or the pause is resumed.
 *
 * CAVEATS (read before enabling):
 * - Bypassed in seconds via Sources tab -> "Deactivate breakpoints", or by
 *   disabling the debugger in browser settings. It is a deterrent, not a lock.
 * - It freezes the page for ANYONE with DevTools open, including you, a
 *   teammate debugging a real issue, or accessibility tooling that uses
 *   DevTools — not just someone snooping.
 * - It repeats on an interval, so the freeze recurs the whole time DevTools
 *   stays open, which can look like the site has crashed.
 *
 * @param {number} intervalMs how often to check (default 1000ms)
 * @param {number} thresholdMs how long a `debugger;` pause must last to count
 *   as "DevTools is open" (default 100ms — a closed DevTools pass is <1ms)
 * @returns cleanup function to stop the guard
 */
export function guardAgainstDevTools(intervalMs = 1000, thresholdMs = 100) {
  const timer = setInterval(() => {
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const elapsed = performance.now() - start;
    if (elapsed > thresholdMs) {
      // DevTools was open long enough to catch the pause. Nothing extra to
      // do here — the debugger statement itself already froze execution;
      // this branch just exists if you want to add your own reaction
      // (e.g. redirect, show a warning) once execution resumes.
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
