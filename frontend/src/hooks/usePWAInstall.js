import { useCallback, useEffect, useState } from 'react';

// Captured at module load so the browser's install prompt is not missed if it fires early.
let deferredPrompt = null;
let appInstalled = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    appInstalled = true;
    emit();
  });
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

export default function usePWAInstall() {
  const [, rerender] = useState(0);

  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable';
    const promptEvent = deferredPrompt;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    deferredPrompt = null;
    emit();
    return outcome; // 'accepted' | 'dismissed'
  }, []);

  return {
    installed: appInstalled || isStandalone(),
    isIOS: isIOS(),
    install,
  };
}
