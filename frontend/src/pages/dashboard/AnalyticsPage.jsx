import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import api from '../../services/api.js';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

const chartTooltipStyle = {
  background: 'rgba(13,18,32,0.9)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  color: '#F1F5F9',
  fontSize: 12,
};

export default function AnalyticsPage() {
  const { projectId } = useParams();
  const [velocity, setVelocity] = useState(null);
  const [productivity, setProductivity] = useState(null);
  const [devops, setDevops] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [burndown, setBurndown] = useState(null);

  useEffect(() => {
    api.get(`/analytics/${projectId}/velocity`).then(({ data }) => setVelocity(data.velocity)).catch(() => setVelocity([]));
    api.get(`/analytics/${projectId}/productivity`).then(({ data }) => setProductivity(data.productivity)).catch(() => setProductivity([]));
    api.get(`/analytics/${projectId}/devops-metrics`).then(({ data }) => setDevops(data)).catch(() => setDevops(null));
    api.get(`/analytics/${projectId}/task-completion`).then(({ data }) => setCompletion(data)).catch(() => setCompletion(null));
    api.get('/sprints', { params: { project: projectId } }).then(({ data }) => {
      setSprints(data.sprints);
      const active = data.sprints.find((s) => s.status === 'Active') || data.sprints[0];
      if (active) {
        api.get(`/analytics/${projectId}/burndown/${active._id}`).then(({ data }) => setBurndown(data)).catch(() => {});
      }
    }).catch(() => {});
  }, [projectId]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-ink-400">Sprint health and delivery signals in one view.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Task completion" value={completion ? `${completion.completionRate}%` : null} sub={completion ? `${completion.done}/${completion.total} tasks` : ''} />
        <StatCard label="Build success rate" value={devops ? `${devops.buildSuccessRate}%` : null} sub={devops ? `${devops.totalDeployments} deployments` : ''} />
        <StatCard label="Active sprints" value={sprints.filter((s) => s.status === 'Active').length ?? null} sub={`${sprints.length} total sprints`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="Sprint burndown">
          {burndown === null ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mergeBurndown(burndown)}>
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="ideal" stroke="#94A3B8" strokeDasharray="4 4" dot={false} name="Ideal" />
                <Area type="monotone" dataKey="actual" stroke="#7C5CFC" fill="url(#actualGrad)" name="Actual" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel title="Sprint velocity">
          {velocity === null ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={velocity}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="sprint" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="committed" fill="rgba(148,163,184,0.35)" radius={[6, 6, 0, 0]} name="Committed" />
                <Bar dataKey="completed" fill="#22D3EE" radius={[6, 6, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel title="Team productivity (30 days)">
          {productivity === null ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={productivity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis dataKey="member" type="category" stroke="#94A3B8" fontSize={11} width={90} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="tasksCompleted" fill="#34D399" radius={[0, 6, 6, 0]} name="Tasks completed" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel title="Deployment frequency">
          {devops === null ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={devops.deploymentFrequency}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="#FBBF24" strokeWidth={2} dot={{ r: 3 }} name="Deployments" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}

function mergeBurndown(data) {
  const { ideal = [], actual = [] } = data;
  const map = new Map();
  ideal.forEach((d) => map.set(d.date.slice(0, 10), { date: d.date.slice(5, 10), ideal: d.remainingPoints }));
  actual.forEach((d) => {
    const key = d.date.slice(0, 10);
    const existing = map.get(key) || { date: key.slice(5, 10) };
    map.set(key, { ...existing, actual: d.remainingPoints });
  });
  return Array.from(map.values());
}

function StatCard({ label, value, sub }) {
  return (
    <div className="glass-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value ?? <span className="skeleton inline-block h-8 w-16 align-middle" />}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

function ChartPanel({ title, children }) {
  return (
    <div className="glass-card p-5">
      <h3 className="mb-4 font-display text-sm font-semibold text-ink-200">{title}</h3>
      {children}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="skeleton h-[280px] w-full" />;
}
