import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Shared layout for Privacy, Terms and other policy pages. */
export default function LegalLayout({ title, updated, children }) {
  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/icon-192.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="font-display text-base font-semibold">DevTrack AI</span>
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm text-ink-400 hover:text-white">
            <ArrowLeft size={16} /> Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-ink-500">Last updated: {updated}</p>
        <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink-300">{children}</div>
      </main>

      <footer className="border-t border-white/[0.06] py-6 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} DevTrack AI. All rights reserved.
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-ink-100">{title}</h2>
      {children}
    </section>
  );
}
