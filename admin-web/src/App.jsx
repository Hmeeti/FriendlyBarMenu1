import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import Shell from './components/Shell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MenuPage from './pages/MenuPage';
import AuditPage from './pages/AuditPage';
import AdminsPage from './pages/AdminsPage';
import './styles/index.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Shell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/admins" element={<AdminsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
