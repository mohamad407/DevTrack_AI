import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import useOnlineStatus from '../../hooks/useOnlineStatus.js';

/** Shows a warning bar while offline, and a short confirmation when the connection returns. */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  const [justReconnected, setJustReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setJustReconnected(false);
    } else if (wasOffline) {
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 2500);
      setWasOffline(false);
      return () => clearTimeout(t);
    }
  }, [online, wasOffline]);

  const show = !online || justReconnected;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className={`fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
            online ? 'bg-success text-void' : 'bg-warning text-void'
          }`}
        >
          {online ? (
            <><Wifi size={16} /> Back online</>
          ) : (
            <><WifiOff size={16} /> You're offline. Some features need a connection.</>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
