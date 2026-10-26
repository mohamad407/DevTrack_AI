import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Loader2, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import GoogleButton, { AuthDivider } from '../components/auth/GoogleButton.jsx';
import PasswordStrength from '../components/auth/PasswordStrength.jsx';
import { signUpWithEmail, signInWithGoogle, friendlyAuthError } from '../services/firebase.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  const emailInvalid = emailTouched && form.email && !EMAIL_RE.test(form.email);

  const showError = (msg, code = '') => {
    setError(msg);
    setErrorCode(code);
    setShakeKey((k) => k + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return showError('Please enter your name.');
    if (!EMAIL_RE.test(form.email)) return showError('Please enter a valid email address.');
    if (form.password.length < 6) return showError('Your password needs at least 6 characters.');

    setLoading(true);
    try {
      await signUpWithEmail({ ...form, name: form.name.trim() });
      toast.success('Almost there! Check your email to verify your account.');
      navigate('/verify-email');
    } catch (err) {
      showError(friendlyAuthError(err), err?.code);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Welcome to DevTrack AI!');
      navigate('/dashboard');
    } catch (err) {
      const msg = friendlyAuthError(err);
      if (msg) showError(msg, err?.code);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Start planning your first sprint in minutes"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-light hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleButton
          label="Sign up with Google"
          loading={googleLoading}
          disabled={loading}
          onClick={handleGoogle}
        />

        <AuthDivider>or sign up with email</AuthDivider>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <motion.div
              key={shakeKey}
              role="alert"
              animate={{ x: [0, -8, 8, -6, 6, 0] }}
              transition={{ duration: 0.4 }}
              className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span>{error}</span>
                {errorCode === 'auth/email-already-in-use' && (
                  <div>
                    <Link to="/login" className="font-medium underline underline-offset-2">
                      Log in instead
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <div className="relative">
            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              autoComplete="name"
              autoFocus
              placeholder="Full name"
              className="input-glass pl-10"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="email"
                autoComplete="email"
                placeholder="Work email"
                aria-invalid={!!emailInvalid}
                className={`input-glass pl-10 ${emailInvalid ? 'border-danger/60' : ''}`}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onBlur={() => setEmailTouched(true)}
              />
            </div>
            {emailInvalid && (
              <p className="mt-1.5 text-xs text-danger">Enter a valid email, like name@company.com</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Create a password"
                className="input-glass pl-10 pr-10"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyDown={(e) => setCapsOn(e.getModifierState('CapsLock'))}
                onKeyUp={(e) => setCapsOn(e.getModifierState('CapsLock'))}
                onBlur={() => setCapsOn(false)}
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
            {capsOn && <p className="text-xs text-warning">Caps Lock is on</p>}
            <PasswordStrength password={form.password} />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="btn-primary group w-full py-2.5"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Creating your account…
              </>
            ) : (
              <>
                Create account <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-ink-500">
            We&apos;ll email you a verification link. You&apos;ll confirm it before the dashboard unlocks.
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
