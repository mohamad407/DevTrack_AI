import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, MailCheck, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import api from '../services/api.js';
import { auth, logout, getCurrentIdToken } from '../services/firebase.js';
import { useAuth } from '../context/AuthContext.jsx';

const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();
  const email = auth.currentUser?.email || '';

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const inputs = useRef([]);
  const sentOnce = useRef(false);

  // Already verified: go to the dashboard. Not signed in: go to login.
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
    else if (!auth.currentUser) navigate('/login', { replace: true });
  }, [user, navigate]);

  // Countdown before the next code can be requested
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async ({ silent = false } = {}) => {
    const idToken = await getCurrentIdToken();
    if (!idToken) return;
    setSending(true);
    try {
      const { data } = await api.post('/auth/otp/send', { idToken });
      if (data.alreadyVerified) {
        await refreshSession();
        return;
      }
      setCooldown(data.resendInSeconds || 60);
      if (!silent) toast.success('A new 6-digit code is on its way');
    } catch (err) {
      if (err.response?.status === 429) {
        setCooldown(err.response.data.retryAfter || 60);
        if (!silent) toast('Please wait a moment before asking for another code', { icon: '⏳' });
      } else {
        toast.error(err.response?.data?.message || 'Could not send the code. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  // Send the first code when the page opens (once, even in development's double-render)
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    sendCode();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async (value) => {
    if (verifying) return;
    setError('');
    setVerifying(true);
    try {
      const idToken = await getCurrentIdToken();
      await api.post('/auth/otp/verify', { idToken, code: value });
      toast.success('Email verified. Welcome to DevTrack AI!');
      await refreshSession(); // rebuilds the DevTrack session now that the email is verified
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'That code didn\u2019t match. Please try again.');
      setShakeKey((k) => k + 1);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const handleChange = (index, raw) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      setDigits((d) => d.map((x, i) => (i === index ? '' : x)));
      return;
    }

    const next = [...digits];
    if (clean.length > 1) {
      // Pasted code: fill the boxes from the start
      for (let i = 0; i < CODE_LENGTH; i++) next[i] = clean[i] || '';
      setDigits(next);
      inputs.current[Math.min(clean.length, CODE_LENGTH) - 1]?.focus();
    } else {
      next[index] = clean;
      setDigits(next);
      if (index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
    }

    if (next.every(Boolean)) verify(next.join(''));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const useDifferentAccount = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <AuthLayout
      title="Enter your verification code"
      subtitle={`We sent a 6-digit code to ${email || 'your email'}`}
    >
      <div className="space-y-6">
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-aurora/15 text-primary-light">
            <MailCheck size={26} />
          </span>
        </div>

        <motion.div
          key={shakeKey}
          animate={shakeKey ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center gap-2 sm:gap-3"
        >
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputs.current[i] = el)}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              autoFocus={i === 0}
              disabled={verifying}
              aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
              className="h-14 w-12 rounded-xl border border-white/10 bg-white/[0.04] text-center font-mono text-xl font-semibold text-ink-100 outline-none transition-all duration-200 focus:border-primary-light focus:bg-primary/10 focus:ring-2 focus:ring-primary/30 disabled:opacity-60 sm:h-16 sm:w-14"
            />
          ))}
        </motion.div>

        {verifying && (
          <p className="flex items-center justify-center gap-2 text-sm text-ink-400">
            <Loader2 size={15} className="animate-spin" /> Checking your code…
          </p>
        )}

        {error && (
          <p role="alert" className="flex items-center justify-center gap-2 text-center text-sm text-danger">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => sendCode()}
          disabled={sending || cooldown > 0}
          className="btn-ghost w-full py-2.5"
        >
          <RefreshCcw size={16} className={sending ? 'animate-spin' : ''} />
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>

        <p className="text-center text-xs text-ink-500">
          Didn&apos;t get it? Check your spam folder. The code expires in 10 minutes.
        </p>

        <button
          type="button"
          onClick={useDifferentAccount}
          className="block w-full text-center text-xs text-ink-400 hover:text-primary-light"
        >
          Use a different account
        </button>
      </div>
    </AuthLayout>
  );
}
