import { Bell, BellOff, Loader2 } from 'lucide-react';
import usePushNotifications from '../../hooks/usePushNotifications.js';

export default function NotificationToggle() {
  const { supported, permission, subscribed, busy, subscribe, unsubscribe } = usePushNotifications();

  if (!supported) {
    return (
      <p className="text-sm text-ink-400">
        Push notifications aren't available in this browser. On iPhone, add DevTrack AI to your Home Screen first (iOS 16.4 or later), then open it from there.
      </p>
    );
  }

  const blocked = permission === 'denied';

  let description = 'Get alerts for mentions, assignments, and sprint deadlines, even when the app is closed.';
  if (blocked) description = 'Notifications are blocked in your browser settings. Allow them for this site, then try again.';
  else if (subscribed) description = 'You will get alerts for mentions, assignments, and sprint deadlines on this device.';

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-400">{description}</p>
      {subscribed ? (
        <button type="button" onClick={unsubscribe} disabled={busy} className="btn-ghost text-sm disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <BellOff size={16} />}
          Turn off
        </button>
      ) : (
        <button type="button" onClick={subscribe} disabled={busy || blocked} className="btn-primary text-sm disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
          Turn on
        </button>
      )}
    </div>
  );
}
