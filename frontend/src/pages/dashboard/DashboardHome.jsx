import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FolderKanban, Plus, ArrowUpRight } from 'lucide-react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

export default function DashboardHome() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);

  useEffect(() => {
    api.get('/projects').then(({ data }) => setProjects(data.projects)).catch(() => setProjects([]));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="mt-1 text-ink-400">Here's what's moving across your workspaces.</p>
      </motion.div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Your projects</h2>
        <Link to="/dashboard/projects" className="btn-primary text-sm">
          <Plus size={16} /> New project
        </Link>
      </div>

      {projects === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 py-16 text-center">
          <FolderKanban size={32} className="text-ink-600" />
          <p className="text-ink-300">No projects yet. Create one to start your first sprint.</p>
          <Link to="/dashboard/projects" className="btn-primary mt-2 text-sm">
            <Plus size={16} /> Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p._id}
              to={`/dashboard/projects/${p._id}/board`}
              className="glass-card group flex flex-col gap-3 p-5 transition-transform hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="flex items-center justify-between">
                <span className="badge font-mono text-primary-light">{p.key}</span>
                <ArrowUpRight size={16} className="text-ink-600 transition-colors group-hover:text-primary-light" />
              </div>
              <h3 className="font-display text-base font-semibold">{p.name}</h3>
              <p className="line-clamp-2 text-sm text-ink-400">{p.description || 'No description yet.'}</p>
              <div className="mt-2 flex -space-x-2">
                {p.members?.slice(0, 4).map((m) => (
                  <span
                    key={m.user?._id}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-void-700 bg-aurora text-[11px] font-semibold text-white"
                    title={m.user?.name}
                  >
                    {m.user?.name?.[0]}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
