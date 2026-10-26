import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import GoogleButton, { AuthDivider } from '../components/auth/GoogleButton.jsx';
import { loginWithEmail, signInWithGoogle, friendlyAuthError } from '../services/firebase.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  const emailInvalid = emailTouched && form.email && !EMAIL_RE.test(form.email);

  const showError = (msg) => {
    setError(msg);
    setShakeKey((k) => k + 1); // changing the key replays the shake animation
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(form.email)) return showError('Please enter a valid email address.');
    if (!form.password) return showError('Please enter your password.');

    setLoading(true);
    try {
      await loginWithEmail(form);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      showError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Welcome!');
      navigate('/dashboard');
    } catch (err) {
      const msg = friendlyAuthError(err);
      if (msg) showError(msg); // null means the user closed the window on purpose
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to pick up where you left off"
      footer={
        <>
          New to DevTrack?{' '}
          <Link to="/signup" className="font-medium text-primary-light hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleButton
          label="Continue with Google"
          loading={googleLoading}
          disabled={loading}
          onClick={handleGoogle}
        />

        <AuthDivider>or log in with email</AuthDivider>

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
              <span>{error}</span>
            </motion.div>
          )}

          <div>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="email"
                autoComplete="email"
                autoFocus
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

          <div>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
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
            {capsOn && <p className="mt-1.5 text-xs text-warning">Caps Lock is on</p>}
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-ink-400 hover:text-primary-light">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="btn-primary group w-full py-2.5"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Logging in…
              </>
            ) : (
              <>
                Log in <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
