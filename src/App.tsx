import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth, AuthProvider } from './context/AuthContext';
import AdminLogin from './pages/admin/AdminLogin';
import OwnerLogin from './pages/owner/OwnerLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AuctionView from './pages/owner/AuctionView';
import DisplayScreen from './pages/DisplayScreen';

type PrivateProps = { children: React.ReactElement; requiredRole?: 'admin' | 'owner' };
function Private({ children, requiredRole }: PrivateProps) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f0] flex items-center justify-center text-[#540816] font-display">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-lg border border-[#cfa027]/30">
          <div className="w-5 h-5 border-2 border-[#540816] border-t-transparent rounded-full animate-spin" />
          <span className="font-bold tracking-wide">Loading SPL Season 2 Arena...</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/owner/login" replace />;
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/owner/auction'} replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <Private requiredRole="admin">
                <AdminDashboard />
              </Private>
            }
          />

          {/* Team Owner / Manager Routes */}
          <Route path="/owner/login" element={<OwnerLogin />} />
          <Route
            path="/owner/auction"
            element={
              <Private requiredRole="owner">
                <AuctionView />
              </Private>
            }
          />

          {/* TV / Arena Projector Display (Public) */}
          <Route path="/display" element={<DisplayScreen />} />

          {/* Default redirect to Owner Login */}
          <Route path="*" element={<Navigate to="/owner/login" replace />} />
        </Routes>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#540816',
              color: '#f8f6f0',
              border: '1px solid #cfa027',
              borderRadius: '12px',
              fontWeight: 600
            }
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
