import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Shield, Lock, Mail, ArrowRight } from 'lucide-react';
import SPLHeader from '../../components/SPLHeader';

export default function AdminLogin() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.success && res.role === 'admin') {
        toast.success('Admin login successful!');
        window.location.href = '/admin/dashboard';
      } else {
        toast.error('This account does not have Admin privileges.');
      }
    } catch {
      toast.error('Invalid admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f6f0] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="w-full max-w-md bg-white border-2 border-[#cfa027]/40 rounded-3xl p-6 sm:p-8 shadow-card-lg relative z-10">
        <div className="mb-6">
          <SPLHeader subtitle="CHIEF AUCTIONEER PORTAL" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-2">
              Admin Email
            </label>
            <div className="relative">
              <input
                type="email"
                placeholder="admin@spl.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl pl-11 pr-4 py-3.5 text-[#1c1917] text-sm focus:outline-none focus:ring-2 focus:ring-[#540816]"
              />
              <Mail className="w-4 h-4 absolute left-3.5 top-4 text-[#997316]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-2">
              Master Password
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl pl-11 pr-4 py-3.5 text-[#1c1917] text-sm focus:outline-none focus:ring-2 focus:ring-[#540816] font-mono"
              />
              <Lock className="w-4 h-4 absolute left-3.5 top-4 text-[#997316]" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] font-display font-black text-sm uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <span>{loading ? 'Verifying...' : 'Access Admin Control'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center pt-3 border-t border-[#e5ded1]">
            <a href="/owner/login" className="text-xs text-[#540816] hover:underline font-bold inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#cfa027]" /> Switch to Team Manager Login
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
