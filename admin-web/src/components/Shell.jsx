import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/menu', label: 'Menu' },
  { to: '/audit', label: 'Activity Logs' },
  { to: '/admins', label: 'Admins', role: 'SUPER_ADMIN' },
];

export default function Shell() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="p-10 text-[var(--muted)]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen grid lg:grid-cols-[240px_1fr]">
      <aside className="border-r border-[var(--line)] bg-[color-mix(in_srgb,white_70%,transparent)] backdrop-blur p-5">
        <div className="brand text-3xl mb-1">Friendly</div>
        <div className="text-sm text-[var(--muted)] mb-8">Menu Admin</div>
        <nav className="flex flex-col gap-1">
          {links
            .filter((l) => !l.role || user.role === l.role)
            .map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-white/80 text-[var(--ink)]'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
        </nav>
        <div className="mt-10 pt-6 border-t border-[var(--line)]">
          <div className="text-sm font-semibold">{user.name}</div>
          <div className="text-xs text-[var(--muted)] mb-3">{user.email}</div>
          <span className="badge badge-role mb-4">{user.role}</span>
          <button type="button" className="btn btn-ghost w-full mt-3" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="p-5 md:p-8 max-w-6xl w-full">
        <Outlet />
      </main>
    </div>
  );
}
