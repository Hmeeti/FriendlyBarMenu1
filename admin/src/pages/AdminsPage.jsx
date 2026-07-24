import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function AdminsPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', email: '', name: '', password: '', role: 'MANAGER' });
  const [error, setError] = useState('');

  if (user?.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />;

  async function load() {
    const d = await api.admins();
    setUsers(d.users);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createAdmin(form);
      setForm({ username: '', email: '', name: '', password: '', role: 'MANAGER' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-4xl mb-1">Admins</h1>
      <p className="text-[var(--muted)] mb-6">Super Admin can create Manager / Super Admin accounts.</p>

      <form onSubmit={onCreate} className="card p-5 grid md:grid-cols-2 gap-3 mb-6 max-w-3xl">
        <input className="input" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Username" required minLength={3} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="input" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" type="password" placeholder="Password (min 7)" required minLength={7} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="MANAGER">MANAGER</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
        </select>
        {error && <div className="md:col-span-2 text-sm text-[var(--warn)]">{error}</div>}
        <button className="btn btn-primary md:col-span-2 w-fit" type="submit">Create admin</button>
      </form>

      <div className="card overflow-hidden max-w-3xl">
        <table className="w-full text-sm">
          <thead className="bg-[#f3eee5] text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Username</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[var(--line)]">
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.username}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3"><span className="badge badge-role">{u.role}</span></td>
                <td className="p-3">{u.isActive ? 'Active' : 'Disabled'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
