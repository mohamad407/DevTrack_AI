import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Search, Bell, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api.get('/notifications').then(({ data }) => setNotifications(data.notifications)).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-void-700/70 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        <button className="lg:hidden" onClick={onMenuClick} aria-label="Open menu">
          <Menu size={22} />
        </button>
        <div className="relative hidden max-w-sm flex-1 sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input placeholder="Search projects, stories, tasks…" className="input-glass py-2 pl-9 text-sm" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] transition-colors hover:bg-white/[0.08]"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="glass-card absolute right-0 mt-2 max-h-96 w-80 overflow-y-auto p-2">
              {notifications.length === 0 ? (
                <p className="p-4 text-center text-sm text-ink-500">You're all caught up.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n._id} className={`rounded-lg p-3 text-sm ${!n.read ? 'bg-white/[0.04]' : ''}`}>
                    <p className="text-ink-200">{n.message}</p>
                    <p className="mt-1 text-xs text-ink-500">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aurora font-display text-sm font-semibold text-white">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </span>
          </button>
          {menuOpen && (
            <div className="glass-card absolute right-0 mt-2 w-52 p-2">
              <p className="truncate px-3 py-2 text-sm font-medium">{user?.name}</p>
              <p className="truncate px-3 pb-2 text-xs text-ink-500">{user?.email}</p>
              <hr className="my-1 border-white/[0.06]" />
              <Link to="/dashboard/profile" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-white/[0.05]">
                <UserIcon size={15} /> Profile
              </Link>
              <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-white/[0.05]">
                <LogOut size={15} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
