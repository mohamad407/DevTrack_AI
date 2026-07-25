import { GitBranch } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-aurora">
            <GitBranch size={14} className="text-white" />
          </span>
          <span className="font-display text-sm font-semibold">DevTrack AI</span>
        </div>
        <p className="text-xs text-ink-500">© {new Date().getFullYear()} DevTrack AI. Built for teams who ship.</p>
      </div>
    </footer>
  );
}
