import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import { loginWithEmail } from '../services/firebase.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await loginWithEmail(form);
      if (!user.emailVerified) {
        toast('We re-sent a verification link to your email', { icon: '📧' });
        navigate('/verify-email');
        return;
      }
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim() || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your sprint"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-primary-light hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="Password"
            className="input-glass pl-10"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-ink-400 hover:text-primary-light">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
}
