import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'Is DevTrack AI free to use?',
    a: 'Yes. DevTrack AI is free for small teams, and you do not need a credit card to sign up.',
  },
  {
    q: 'How do I create an account?',
    a: 'Sign up with your email address. We send a one-time verification code to confirm it. Once your email is verified, the dashboard unlocks.',
  },
  {
    q: 'Can I install DevTrack AI like an app?',
    a: 'Yes. Click the Install button in the navigation bar or on your dashboard. On Chrome, Edge and Android it installs directly. On iPhone and iPad, open the site in Safari, tap Share, and choose Add to Home Screen.',
  },
  {
    q: 'What does the AI Assistant do?',
    a: 'The AI Assistant helps you plan work by drafting and refining backlog items and stories, so your team spends less time on first drafts.',
  },
  {
    q: 'How does the DevOps section work?',
    a: 'Each project has a DevOps view that tracks build and deployment history across Development, Testing and Production environments, so you can see what shipped and where.',
  },
  {
    q: 'How do I write a review?',
    a: 'Log in, click Write a review, tap a star rating from 1 to 5, and optionally add a comment. Submitting again updates your existing review.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="relative mx-auto max-w-3xl px-6 py-24">
      <div className="mb-12 text-center">
        <span className="badge text-primary-light">FAQ</span>
        <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Questions, answered</h2>
        <p className="mt-3 text-ink-400">Everything you need to know before you get started.</p>
      </div>

      <div className="space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={item.q}
              className={`glass-card overflow-hidden transition-colors ${isOpen ? 'border-primary-light/30' : ''}`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 p-5 text-left"
              >
                <span className="font-medium">{item.q}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-ink-500 transition-transform duration-300 ${
                    isOpen ? 'rotate-180 text-primary-light' : ''
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed text-ink-400">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
