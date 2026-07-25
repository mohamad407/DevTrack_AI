import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import { requestPasswordReset } from '../services/firebase.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      toast.error(err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim() || 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a secure reset link"
      footer={
        <Link to="/login" className="font-medium text-primary-light hover:underline">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={36} className="text-success" />
          <p className="text-sm text-ink-300">
            If an account exists for <span className="text-ink-100">{email}</span>, a reset link is on its way.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="email"
              required
              placeholder="Work email"
              className="input-glass pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
