import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('ilnur000');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-8">
        <div className="brand text-4xl mb-1">Friendly</div>
        <p className="text-[var(--muted)] mb-6">Sign in to manage the electronic menu.</p>
        <label className="block text-sm mb-1">Login</label>
        <input
          className="input mb-4"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          type="text"
          autoComplete="username"
          required
        />
        <label className="block text-sm mb-1">Password</label>
        <input
          className="input mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          required
        />
        {error && <div className="mb-4 text-sm text-[var(--warn)]">{error}</div>}
        <button className="btn btn-primary w-full" disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
