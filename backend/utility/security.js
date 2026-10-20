// Small shared security helpers used across routes.
import mongoose from 'mongoose';

/** Escape user input before building a RegExp (prevents regex injection / ReDoS). */
export const escapeRegex = (s = '') => String(s).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Only allow http(s) links. Blocks javascript:, data:, vbscript: etc. */
export const isSafeHttpUrl = (raw) => {
  try {
    const u = new URL(String(raw));
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

/** Copy only whitelisted keys (stops mass-assignment via Object.assign(doc, req.body)). */
export const pick = (obj = {}, keys = []) => {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

/** Always a plain string (blocks ?status[$ne]=x style operator injection). */
export const str = (v) => (typeof v === 'string' ? v : undefined);

export const isObjectId = (v) => typeof v === 'string' && mongoose.Types.ObjectId.isValid(v);

/** Strip Mongo operators ($...) and dotted keys from body/query/params. */
const clean = (o) => {
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    if (k.startsWith('$') || k.includes('.')) delete o[k];
    else clean(o[k]);
  }
};
export const sanitizeMongo = (req, res, next) => {
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
};
