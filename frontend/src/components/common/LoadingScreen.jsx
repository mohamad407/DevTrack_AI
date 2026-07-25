import { motion } from 'framer-motion';

export default function LoadingScreen() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-void">
      <div className="relative h-14 w-14">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-primary-light/30 border-t-primary-light"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        />
        <motion.span
          className="absolute inset-2 rounded-full border-2 border-cyan-glow/30 border-b-cyan-glow"
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
        />
      </div>
      <p className="font-display text-sm tracking-widest text-ink-500">LOADING DEVTRACK AI</p>
    </div>
  );
}
