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
