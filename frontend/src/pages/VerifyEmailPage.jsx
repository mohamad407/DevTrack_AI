import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck, RefreshCcw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import { auth, resendVerificationEmail } from '../services/firebase.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const checkVerification = async () => {
    setChecking(true);
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        toast.success('Email verified!');
        refreshSession();
      } else {
        toast('Not verified yet — check your inbox', { icon: '📭' });
      }
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      toast.success('Verification email re-sent');
    } catch {
      toast.error('Could not resend right now');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title="Verify your email" subtitle="One more step before your dashboard unlocks">
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aurora/15 text-primary-light">
          <MailCheck size={30} />
        </span>
        <p className="text-sm text-ink-300">
          We sent a verification link to{' '}
          <span className="text-ink-100">{auth.currentUser?.email || 'your email'}</span>. Click it, then
          come back here.
        </p>

        <button onClick={checkVerification} disabled={checking} className="btn-primary w-full py-2.5">
          {checking ? <Loader2 size={18} className="animate-spin" /> : "I've verified — continue"}
        </button>
        <button onClick={resend} disabled={resending} className="btn-ghost w-full py-2.5">
          <RefreshCcw size={16} className={resending ? 'animate-spin' : ''} /> Resend email
        </button>
      </div>
    </AuthLayout>
  );
}
