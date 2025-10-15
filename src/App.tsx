import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth, AuthProvider } from './context/AuthContext';
import AdminLogin from './pages/admin/AdminLogin';
import OwnerLogin from './pages/owner/OwnerLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AuctionView from './pages/owner/AuctionView';
import DisplayScreen from './pages/DisplayScreen';

type PrivateProps = { children: React.ReactElement };
function Private({ children }: PrivateProps) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading…</div>;
  return user ? children : <Navigate to="/owner/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<Private><AdminDashboard /></Private>} />

          {/* Owner */}
          <Route path="/owner/login" element={<OwnerLogin />} />
          <Route path="/owner/auction" element={<Private><AuctionView /></Private>} />
          <Route path="/owner/squad" element={<Private><div>My Squad (WIP)</div></Private>} />
          <Route path="/owner/standings" element={<Private><div>Standings (WIP)</div></Private>} />

          {/* Display */}
          <Route path="/display" element={<DisplayScreen />} />
          <Route path="*" element={<Navigate to="/owner/login" replace />} />
        </Routes>
        <Toaster position="top-center" />
      </BrowserRouter>
    </AuthProvider>
  );
}
