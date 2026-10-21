import { Link } from 'react-router-dom';

const product = [
  { label: 'Features', href: '#features' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'FAQ', href: '#faq' },
];

const company = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Service', to: '/terms' },
];

const CONTACT_EMAIL = 'asihf174@gmail.com';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-void-800/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="font-display text-base font-semibold">
              DevTrack <span className="text-gradient">AI</span>
            </span>
          </div>
          <p className="max-w-sm text-sm text-ink-400">
            Agile planning, DevOps tracking, and AI assistance in one place for teams that ship.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-500">Product</h3>
          <ul className="space-y-3 text-sm">
            {product.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="text-ink-300 transition-colors hover:text-white">{l.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-500">Company</h3>
          <ul className="space-y-3 text-sm">
            {company.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="text-ink-300 transition-colors hover:text-white">{l.label}</Link>
              </li>
            ))}
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink-300 transition-colors hover:text-white">
                Contact us
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/[0.06] py-6 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} DevTrack AI. All rights reserved.
      </div>
    </footer>
  );
}
