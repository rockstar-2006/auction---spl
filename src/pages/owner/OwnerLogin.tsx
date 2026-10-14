import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { INITIAL_TEAMS } from '../../data/teamsData';
import toast from 'react-hot-toast';
import { Shield, Lock, Users, ArrowRight } from 'lucide-react';
import SPLHeader from '../../components/SPLHeader';

export default function OwnerLogin() {
  const { login } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState<string>(INITIAL_TEAMS[0].id);
  const [password, setPassword] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [isManualEmail, setIsManualEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let emailToLogin = '';
      if (isManualEmail) {
        emailToLogin = emailInput.trim();
      } else {
        const team = INITIAL_TEAMS.find(t => t.id === selectedTeamId);
        emailToLogin = team ? team.email : '';
      }

      const res = await login(emailToLogin, password);
      if (res.success) {
        toast.success(`Welcome to SPL Season 2 Auction!`);
        window.location.href = '/owner/auction';
      }
    } catch {
      toast.error('Invalid password or email. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const selectedTeam = INITIAL_TEAMS.find(t => t.id === selectedTeamId);

  return (
    <main className="min-h-screen bg-[#f8f6f0] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="w-full max-w-md bg-white border-2 border-[#cfa027]/40 rounded-3xl p-6 sm:p-8 shadow-card-lg relative z-10">
        {/* Official Banner & Header */}
        <div className="mb-6">
          <SPLHeader subtitle="TEAM MANAGER LOGIN" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isManualEmail ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-2 flex items-center justify-between">
                <span>Select Your Team</span>
                <span className="text-[10px] text-[#645d57] font-semibold">12 Teams</span>
              </label>
              <div className="relative">
                <select
                  value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                  className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-3.5 text-[#1c1917] text-sm focus:outline-none focus:ring-2 focus:ring-[#540816] appearance-none font-bold cursor-pointer"
                >
                  {INITIAL_TEAMS.map(team => (
                    <option key={team.id} value={team.id} className="bg-white text-[#1c1917]">
                      [{team.badge || team.shortName}] {team.name} ({team.shortName})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[#997316]">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              {selectedTeam && (
                <div className="mt-2 text-xs bg-[#f4efe6] p-2.5 rounded-lg border border-[#cfa027]/30 flex items-center justify-between">
                  <span className="text-[#645d57]">Manager: <strong className="text-[#1c1917]">{selectedTeam.email}</strong></span>
                  <span className="text-[#540816] font-mono font-bold">Purse: ₹1,00,000</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-2">
                Team Email
              </label>
              <input
                type="email"
                placeholder="e.g. thunderbolts@spl.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                required
                className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-3.5 text-[#1c1917] text-sm focus:outline-none focus:ring-2 focus:ring-[#540816]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-2">
              Team Passcode
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter your team password"
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
            <span>{loading ? 'Entering Arena...' : 'Login to Auction'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-between text-xs text-[#645d57] pt-3 border-t border-[#e5ded1]">
            <button
              type="button"
              onClick={() => setIsManualEmail(!isManualEmail)}
              className="text-[#540816] hover:underline font-bold"
            >
              {isManualEmail ? 'Switch to Team Dropdown' : 'Login with Email'}
            </button>
            <a href="/admin/login" className="text-[#540816] hover:text-[#730d20] flex items-center gap-1.5 font-bold">
              <Shield className="w-3.5 h-3.5 text-[#cfa027]" /> Admin Portal
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
