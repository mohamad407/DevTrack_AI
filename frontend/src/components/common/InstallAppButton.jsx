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
        className={`group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-aurora font-semibold text-white shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(124,58,237,0.55)] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-2 focus-visible:ring-offset-void ${
          compact ? 'px-4 py-2 text-sm' : 'px-5 py-2.5 text-sm'
        }`}
      >
        {/* soft shine that sweeps across on hover */}
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <Download size={16} className="relative transition-transform duration-300 group-hover:translate-y-0.5" />
        <span className="relative">{compact ? 'Install' : 'Install app'}</span>
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
