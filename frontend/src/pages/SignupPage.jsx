import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import { signUpWithEmail } from '../services/firebase.js';

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(form);
      toast.success('Check your email for a verification link');
      navigate('/verify-email');
    } catch (err) {
      toast.error(err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim() || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Start planning your first sprint"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-light hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            required
            placeholder="Full name"
            className="input-glass pl-10"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="relative">
          <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="email"
            required
            placeholder="Work email"
            className="input-glass pl-10"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="relative">
          <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="password"
            required
            placeholder="Password (min. 6 characters)"
            className="input-glass pl-10"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Create account'}
        </button>

        <p className="text-center text-xs text-ink-500">
          We&apos;ll email you a one-time verification link — you&apos;ll need to confirm it before
          the dashboard unlocks.
        </p>
      </form>
    </AuthLayout>
  );
}
