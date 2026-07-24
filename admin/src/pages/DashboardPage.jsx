import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState({ categories: 0, items: 0, logs: 0 });
  const [live, setLive] = useState('connecting');
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    Promise.all([api.categories(), api.items(), api.audit({ limit: 1 })]).then(([c, i, a]) => {
      setStats({
        categories: c.categories.length,
        items: i.items.length,
        logs: a.total,
      });
    });

    const socket = io('/', { transports: ['websocket', 'polling'] });
    socket.on('connect', () => setLive('live'));
    socket.on('disconnect', () => setLive('offline'));
    socket.on('menu:changed', (msg) => setLastEvent(msg));
    return () => socket.disconnect();
  }, []);

  return (
    <div>
      <h1 className="text-4xl mb-2">Dashboard</h1>
      <p className="text-[var(--muted)] mb-8">Manage categories, dishes, prices, and availability in real time.</p>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          ['Categories', stats.categories],
          ['Dishes', stats.items],
          ['Audit events', stats.logs],
        ].map(([label, value]) => (
          <div key={label} className="card p-5">
            <div className="text-sm text-[var(--muted)]">{label}</div>
            <div className="text-3xl mt-1 font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-2xl">Realtime sync</h2>
          <span className={`badge ${live === 'live' ? 'badge-ok' : 'badge-off'}`}>{live}</span>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Admin changes broadcast over Socket.io so guest menus update without refresh.
        </p>
        {lastEvent && (
          <pre className="mt-4 text-xs bg-[#f3eee5] rounded-lg p-3 overflow-auto">
            {JSON.stringify(lastEvent, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link className="btn btn-primary" to="/menu">Open menu editor</Link>
        <Link className="btn btn-ghost" to="/audit">View activity logs</Link>
      </div>
    </div>
  );
}
