import { motion } from 'framer-motion';

export default function LoadingScreen() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-void">
      <div className="relative flex h-28 w-28 items-center justify-center">
        {/* soft aurora glow pulsing behind the logo */}
        <motion.span
          className="absolute inset-0 rounded-full bg-primary/40 blur-2xl"
          animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.4, 0.9, 0.4] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
        />
        {/* outer ring */}
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-light border-r-cyan-glow"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
        />
        {/* inner ring */}
        <motion.span
          className="absolute inset-3 rounded-full border-2 border-transparent border-b-primary-light/70"
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
        />
        {/* app icon, floating gently */}
        <motion.img
          src="/icon-192.png"
          alt="DevTrack AI"
          width={64}
          height={64}
          className="relative h-16 w-16 rounded-2xl shadow-glow"
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="font-display text-sm font-semibold tracking-[0.3em] text-ink-300">DEVTRACK AI</p>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary-light"
              animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 1, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
