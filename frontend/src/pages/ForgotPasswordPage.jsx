import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, RefreshCcw, ArrowRight } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import OtpBoxes from '../components/auth/OtpBoxes.jsx';
import PasswordStrength from '../components/auth/PasswordStrength.jsx';
import api from '../services/api.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // email -> code -> password -> done
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [attemptKey, setAttemptKey] = useState(0); // changing this replays the shake and clears the boxes

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const fail = (message) => {
    setError(message);
    setAttemptKey((k) => k + 1);
  };

  const sendCode = async () => {
    setError('');
    if (!EMAIL_RE.test(email.trim())) return fail('Please enter a valid email address.');
    setLoading(true);
    try {
      await api.post('/auth/password-reset/send', { email: email.trim() });
      setCooldown(RESEND_SECONDS);
      setStep('code');
    } catch (err) {
      fail(err.response?.data?.message || 'Could not send the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (value) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/password-reset/verify', { email: email.trim(), code: value });
      setResetToken(data.resetToken);
      setStep('password');
    } catch (err) {
      fail(err.response?.data?.message || 'That code didn\u2019t match. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) return fail('Your new password needs at least 6 characters.');
    if (newPassword !== confirmPassword) return fail('The two passwords don\u2019t match.');
    setLoading(true);
    try {
      await api.post('/auth/password-reset/complete', { resetToken, newPassword });
      setStep('done');
    } catch (err) {
      fail(err.response?.data?.message || 'Could not reset your password. Please start again.');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    email: { title: 'Forgot your password?', subtitle: 'We\u2019ll email you a 6-digit code' },
    code: { title: 'Enter your code', subtitle: `We sent a 6-digit code to ${email.trim() || 'your email'}` },
    password: { title: 'Choose a new password', subtitle: 'Make it strong and unique to you' },
    done: { title: 'Password updated', subtitle: 'You can log in with your new password' },
  };

  const ErrorBox = error ? (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{error}</span>
    </p>
  ) : null;

  return (
    <AuthLayout
      title={titles[step].title}
      subtitle={titles[step].subtitle}
      footer={
        <Link to="/login" className="font-medium text-primary-light hover:underline">
          Back to log in
        </Link>
      }
    >
      {step === 'email' && (
        <form onSubmit={(e) => { e.preventDefault(); sendCode(); }} className="space-y-4" noValidate>
          {ErrorBox}
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="Your account email"
              className="input-glass pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary group w-full py-2.5">
            {loading ? <><Loader2 size={18} className="animate-spin" /> Sending code…</> : <>Send code <ArrowRight size={16} /></>}
          </button>
        </form>
      )}

      {step === 'code' && (
        <div className="space-y-6">
          <motion.div
            key={attemptKey}
            initial={{ x: 0 }}
            animate={attemptKey ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <OtpBoxes key={attemptKey} onComplete={verifyCode} disabled={loading} />
          </motion.div>

          {loading && (
            <p className="flex items-center justify-center gap-2 text-sm text-ink-400">
              <Loader2 size={15} className="animate-spin" /> Checking your code…
            </p>
          )}
          {ErrorBox}

          <button
            type="button"
            onClick={sendCode}
            disabled={loading || cooldown > 0}
            className="btn-ghost w-full py-2.5"
          >
            <RefreshCcw size={16} />
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>

          <p className="text-center text-xs text-ink-500">
            Check your spam folder. The code expires in 10 minutes.{' '}
            <button type="button" onClick={() => setStep('email')} className="text-primary-light hover:underline">
              Use a different email
            </button>
          </p>
        </div>
      )}

      {step === 'password' && (
        <form onSubmit={savePassword} className="space-y-4" noValidate>
          {ErrorBox}
          <div className="space-y-3">
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                placeholder="New password"
                className="input-glass pl-10 pr-10"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-200"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <PasswordStrength password={newPassword} />
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Confirm new password"
                className="input-glass pl-10"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? <><Loader2 size={18} className="animate-spin" /> Updating…</> : 'Update password'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-5 py-2 text-center">
          <CheckCircle2 size={44} className="text-success" />
          <p className="text-sm text-ink-300">Your password has been changed. Log in with your new password to continue.</p>
          <button type="button" onClick={() => navigate('/login')} className="btn-primary w-full py-2.5">
            Log in
          </button>
        </div>
      )}
    </AuthLayout>
  );
}
