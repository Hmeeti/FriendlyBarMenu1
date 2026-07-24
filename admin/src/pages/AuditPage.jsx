import { useEffect, useState } from 'react';
import { api } from '../lib/api';

function DiffView({ before, after }) {
  if (!before && !after) return <div className="text-[var(--muted)] text-sm">No snapshot</div>;
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  const rows = keys
    .filter((k) => !['updatedAt', 'createdAt', 'passwordHash', 'category', 'variants', 'modifiers'].includes(k))
    .filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]) || (!before || !after));

  if (!rows.length) {
    return (
      <pre className="text-xs bg-[#f3eee5] rounded-lg p-3 overflow-auto">
        {JSON.stringify({ before, after }, null, 2)}
      </pre>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--muted)]">
            <th className="py-1 pr-3">Field</th>
            <th className="py-1 pr-3">Old</th>
            <th className="py-1">New</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k} className="border-t border-[var(--line)] align-top">
              <td className="py-2 pr-3 font-medium">{k}</td>
              <td className="py-2 pr-3 text-[var(--warn)]">{before ? JSON.stringify(before[k]) : '—'}</td>
              <td className="py-2 text-[var(--accent)]">{after ? JSON.stringify(after[k]) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [selected, setSelected] = useState(null);

  async function load(p = page) {
    const data = await api.audit({ page: p, limit: 30, ...(q ? { q } : {}), ...(action ? { action } : {}) });
    setLogs(data.logs);
    setTotal(data.total);
    setPage(data.page);
  }

  useEffect(() => {
    load(1).catch(console.error);
  }, [q, action]);

  return (
    <div>
      <h1 className="text-4xl mb-1">Activity Logs</h1>
      <p className="text-[var(--muted)] mb-6">Every admin action with timestamp, actor, and old → new values.</p>

      <div className="flex flex-wrap gap-3 mb-5">
        <input className="input max-w-sm" placeholder="Search summary, dish, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select max-w-[160px]" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className="text-sm text-[var(--muted)] self-center">{total} events</div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-5">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f3eee5] text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Admin</th>
                <th className="p-3">Action</th>
                <th className="p-3">Summary</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className={`border-t border-[var(--line)] cursor-pointer hover:bg-white/70 ${selected?.id === log.id ? 'bg-[var(--accent-soft)]' : ''}`}
                  onClick={() => setSelected(log)}
                >
                  <td className="p-3 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="p-3">{log.adminName}</td>
                  <td className="p-3"><span className="badge badge-role">{log.action}</span></td>
                  <td className="p-3">{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5 h-fit sticky top-6">
          <h2 className="text-2xl mb-3">Diff detail</h2>
          {!selected ? (
            <p className="text-[var(--muted)] text-sm">Select a log entry.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div><span className="text-[var(--muted)]">Entity:</span> {selected.entityType} / {selected.entityLabel || selected.entityId}</div>
              <div><span className="text-[var(--muted)]">Admin:</span> {selected.adminName} ({selected.adminEmail})</div>
              <div><span className="text-[var(--muted)]">IP:</span> {selected.ip || '—'}</div>
              <p className="font-medium">{selected.summary}</p>
              <DiffView before={selected.before} after={selected.after} />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => load(page - 1)}>Prev</button>
        <button type="button" className="btn btn-ghost" onClick={() => load(page + 1)}>Next</button>
      </div>
    </div>
  );
}
