import { useEffect, useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';
import toast from 'react-hot-toast';
import usePWAInstall from '../../hooks/usePWAInstall.js';

export default function InstallAppButton({ compact = false }) {
  const { installed, isIOS, install } = usePWAInstall();
  const [helpOpen, setHelpOpen] = useState(false);

  if (installed) return null;

  const handleClick = async () => {
    const outcome = await install();
    if (outcome === 'unavailable') setHelpOpen(true);
    else if (outcome === 'accepted') toast.success('DevTrack AI is being installed');
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? 'flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium transition-colors hover:bg-white/[0.08]'
            : 'btn-primary text-sm'
        }
      >
        <Download size={16} />
        {compact ? 'Install' : 'Install app'}
      </button>
      {helpOpen && <InstallHelp isIOS={isIOS} onClose={() => setHelpOpen(false)} />}
    </>
  );
}

function InstallHelp({ isIOS, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        onClick={(e) => e.stopPropagation()}
        className="glass-panel relative w-full max-w-sm p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-white/[0.06] hover:text-ink-100"
        >
          <X size={16} />
        </button>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-aurora shadow-glow">
          <Smartphone size={22} className="text-white" />
        </div>
        <h3 id="install-title" className="font-display text-lg font-semibold">Install DevTrack AI</h3>
        <p className="mt-1 text-sm text-ink-400">Get the app on your home screen for one-tap access.</p>

        {isIOS ? (
          <ol className="mt-5 space-y-3 text-sm text-ink-300">
            <li className="flex gap-3"><span className="badge h-6 w-6 shrink-0 justify-center p-0">1</span><span>Open this page in Safari, then tap <Share size={14} className="inline" /> Share.</span></li>
            <li className="flex gap-3"><span className="badge h-6 w-6 shrink-0 justify-center p-0">2</span><span>Choose <PlusSquare size={14} className="inline" /> Add to Home Screen.</span></li>
            <li className="flex gap-3"><span className="badge h-6 w-6 shrink-0 justify-center p-0">3</span><span>Tap Add. DevTrack AI now opens like an app.</span></li>
          </ol>
        ) : (
          <div className="mt-5 space-y-3 text-sm text-ink-300">
            <p>In Chrome or Edge, click the install icon in the address bar, or open the browser menu and choose <span className="font-medium text-ink-100">Install app</span>.</p>
            <p>On Android, choose <span className="font-medium text-ink-100">Add to Home screen</span> from the browser menu.</p>
          </div>
        )}

        <button type="button" onClick={onClose} className="btn-ghost mt-6 w-full text-sm">Got it</button>
      </div>
    </div>
  );
}
