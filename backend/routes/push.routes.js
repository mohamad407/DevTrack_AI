import { Router } from 'express';
import PushSubscription from '../models/PushSubscription.model.js';
import { protect } from '../middleware/auth.middleware.js';
import { publicKey, pushConfigured } from '../utility/push.js';

const router = Router();

// Public: the browser needs this key to subscribe.
router.get('/vapid-public-key', (req, res) => {
  if (!pushConfigured) {
    return res.status(503).json({ message: 'Push notifications are not set up on the server yet' });
  }
  res.json({ publicKey });
});

router.post('/subscribe', protect, async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Invalid push subscription' });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { user: req.user._id, endpoint, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) } },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Subscribed' });
  } catch (err) {
    next(err);
  }
});

router.post('/unsubscribe', protect, async (req, res, next) => {
  try {
    await PushSubscription.deleteOne({ endpoint: String(req.body?.endpoint || ''), user: req.user._id });
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    next(err);
  }
});

export default router;
