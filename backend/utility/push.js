import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.model.js';

// Push works only when VAPID keys are configured on the server. Without them,
// notifications still save to the database; they just aren't pushed to devices.
const configured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:asihf174@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export const pushConfigured = configured;
export const publicKey = process.env.VAPID_PUBLIC_KEY || '';

/** Send a push to every device the user has subscribed. Dead subscriptions are removed automatically. */
export const sendPushToUser = async (userId, { title = 'DevTrack AI', body = '', link = '/dashboard' } = {}) => {
  if (!configured) return;
  const subscriptions = await PushSubscription.find({ user: userId }).lean();
  const payload = JSON.stringify({ title, body, link });

  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
      } catch (err) {
        // 404/410 means the browser revoked this subscription (uninstalled app, cleared data)
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: s._id });
        }
      }
    })
  );
};
