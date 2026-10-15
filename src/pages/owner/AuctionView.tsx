import { useEffect, useState } from 'react';
import { db } from '../../services/firebase';
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { AUCTION_DOC_ID } from '../../services/auction.service';
import {
  listenToAuctionState,
  listenToTeams,
  listenToPlayers,
  subscribeDbStatus,
  DbStatus
} from '../../services/supabaseMirror.service';
import { useAuth } from '../../context/AuthContext';
import { AuctionState, BidLog } from '../../types/auction.types';
import { Player } from '../../types/player.types';
import { TeamInfo, INITIAL_TEAMS } from '../../data/teamsData';
import { resolvePlayerPhoto, isFemalePlayer } from '../../utils/playerPhotoResolver';
import TeamBadge from '../../components/TeamBadge';
import toast from 'react-hot-toast';
import {
  Users,
  Trophy,
  Activity,
  Shield,
  LogOut,
  X,
  Clock,
  Download,
  FileSpreadsheet,
  CheckCircle,
  Flame
} from 'lucide-react';
import splBanner from '../../../image.png';

declare global {
  interface Window {
    XLSX?: any;
  }
}

export default function AuctionView() {
  const { user, logout } = useAuth();
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [myTeam, setMyTeam] = useState<TeamInfo | null>(null);
  const [recentBids, setRecentBids] = useState<BidLog[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [mySquadPlayers, setMySquadPlayers] = useState<Player[]>([]);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  const currentTeamId = user?.teamId || 'team_thunderbolts';

  useEffect(() => {
    const unsubStatus = subscribeDbStatus(setDbStatus);

    const unsubAuction = listenToAuctionState((data) => {
      setAuction(data);
    });

    const unsubTeams = listenToTeams((tlist) => {
      const tm = tlist.find(t => t.id === currentTeamId);
      if (tm) {
        setMyTeam(tm);
      } else {
        const defaultT = INITIAL_TEAMS.find(t => t.id === currentTeamId);
        if (defaultT) setMyTeam(defaultT);
      }
    });

    const unsubPlayers = listenToPlayers((plist) => {
      setAllPlayers(plist);
    });

    return () => {
      unsubStatus();
      unsubAuction();
      unsubTeams();
      unsubPlayers();
    };
  }, [currentTeamId]);

  // Listen to bids ONLY for the currently active player
  useEffect(() => {
    const targetPlayerId = auction?.currentPlayerId;
    if (!targetPlayerId) {
      setRecentBids([]);
      return;
    }

    const bidsQ = query(collection(db, 'bids'), orderBy('timestamp', 'desc'), limit(20));
    const unsubBids = onSnapshot(bidsQ, (snap) => {
      const blist: BidLog[] = [];
      snap.forEach(d => {
        const data = d.data() as BidLog;
        if (data.playerId === targetPlayerId) {
          blist.push({ id: d.id, ...data });
        }
      });
      setRecentBids(blist.slice(0, 8));
    }, () => {});

    return () => unsubBids();
  }, [auction?.currentPlayerId]);

  useEffect(() => {
    if (!auction?.currentPlayerId) {
      setCurrentPlayer(null);
      return;
    }
    // High-performance optimization: If auction doc already embeds the currentPlayer, use zero reads!
    if (auction.currentPlayer && auction.currentPlayer.id === auction.currentPlayerId) {
      setCurrentPlayer(auction.currentPlayer);
      return;
    }
    const found = allPlayers.find(p => p.id === auction.currentPlayerId);
    if (found) {
      setCurrentPlayer(found);
    } else {
      const unsubPlayer = onSnapshot(doc(db, 'players', auction.currentPlayerId), (snap) => {
        if (snap.exists()) {
          setCurrentPlayer({ id: snap.id, ...snap.data() } as Player);
        }
      }, () => {});
      return () => unsubPlayer();
    }
  }, [auction?.currentPlayerId, auction?.currentPlayer, allPlayers]);

  // Sync squad players whenever myTeam or allPlayers changes
  useEffect(() => {
    if (!myTeam?.playerIds || myTeam.playerIds.length === 0) {
      setMySquadPlayers([]);
      return;
    }
    const squad = allPlayers.filter(p => myTeam.playerIds.includes(p.id));
    setMySquadPlayers(squad);
  }, [myTeam?.playerIds, allPlayers]);

  useEffect(() => {
    setFailedImages({});
  }, [currentPlayer?.id]);

  const squadSize = mySquadPlayers.length || myTeam?.squadSize || 0;
  const maxSquadSize = myTeam?.maxSquadSize || 15;
  const remainingSlots = Math.max(0, maxSquadSize - squadSize);
  const purseRemaining = myTeam?.purseRemaining ?? 100000;
  const totalSpent = myTeam?.totalSpent ?? 0;

  const myGirlsCount = mySquadPlayers.filter(p => isFemalePlayer(p)).length;
  const myBoysCount = mySquadPlayers.length - myGirlsCount;
  const neededGirls = Math.max(0, 1 - myGirlsCount);
  const neededBoys = Math.max(0, 11 - myBoysCount);
  const compulsorySlotsNeeded = neededGirls + neededBoys;
  const reserveFundRequired = compulsorySlotsNeeded > 1 ? (compulsorySlotsNeeded - 1) * 1000 : 0;
  const maxAffordableBid = squadSize >= 15 ? 0 : Math.max(0, purseRemaining - reserveFundRequired);

  const currentIsGirl = currentPlayer ? isFemalePlayer(currentPlayer) : false;
  const phase = auction?.auctionPhase || 'girls';
  let myTeamLockReason = '';
  if (phase === 'girls' && currentIsGirl && myGirlsCount >= 1) {
    myTeamLockReason = '🎀 1 Compulsory Female Acquired — Standing by while other teams complete their female slot.';
  } else if (phase === 'boys' && !currentIsGirl && myBoysCount >= 11) {
    myTeamLockReason = '🏏 11 Boys Threshold Reached — Standing by while all teams reach 11 boys.';
  } else if (squadSize >= 15) {
    myTeamLockReason = '🛡️ Squad Full (15/15) — Maximum limit reached.';
  }

  const currentBid = auction?.currentBid ?? (currentPlayer?.basePrice || 1000);
  const isLeading = auction?.currentBidderId === currentTeamId;
  const hasAnyBids = !!auction?.currentBidderId;

  // 1-Click Excel / CSV Squad Downloader
  const handleDownloadSquadExcel = () => {
    if (mySquadPlayers.length === 0) {
      toast.error('Your team has not recruited any players yet!');
      return;
    }

    const teamTitle = myTeam?.name || 'My_Team';
    const cleanTeamName = teamTitle.replace(/\s+/g, '_');

    if (window.XLSX) {
      const dataToExport = mySquadPlayers.map((p, idx) => ({
        'Serial No': p.serialNo || idx + 1,
        'Player Name': p.name,
        'Role': p.role,
        'Year / Category': p.category || '4th Year',
        'Price Bought (₹)': p.soldPrice || p.currentBid || 1000,
        'Batting Style': p.battingStyle || 'Right Hand',
        'Bowling Style': p.bowlingStyle || 'Right Arm Medium',
        'Contact': p.contact || ''
      }));

      const ws = window.XLSX.utils.json_to_sheet(dataToExport);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Squad');
      window.XLSX.writeFile(wb, `${cleanTeamName}_SPL2026_Squad.xlsx`);
      toast.success(`Downloaded ${myTeam?.name} Squad Excel!`);
    } else {
      // CSV Fallback
      const headers = ['Serial No', 'Player Name', 'Role', 'Year / Category', 'Price Bought (₹)', 'Batting Style', 'Bowling Style', 'Contact'];
      const rows = mySquadPlayers.map((p, idx) => [
        `"${p.serialNo || idx + 1}"`,
        `"${p.name}"`,
        `"${p.role}"`,
        `"${p.category || '4th Year'}"`,
        `"${p.soldPrice || p.currentBid || 1000}"`,
        `"${p.battingStyle || 'Right Hand'}"`,
        `"${p.bowlingStyle || 'Right Arm Medium'}"`,
        `"${p.contact || ''}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${cleanTeamName}_SPL2026_Squad.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloaded ${myTeam?.name} Squad CSV!`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f0] text-[#1c1917] flex flex-col font-sans pb-16">
      {/* Top Header - Warm Poster Palette */}
      <header className="bg-gradient-to-r from-[#3e040d] via-[#540816] to-[#3e040d] border-b-2 border-[#cfa027]/50 px-4 sm:px-6 py-3 text-white sticky top-0 z-40 shadow-card-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TeamBadge team={myTeam} className="w-10 h-10 rounded-xl text-sm border-2 border-white/20" />
            <div>
              <div className="text-[10px] font-bold text-[#e5bf5b] uppercase tracking-widest">
                SMVITM SPL SEASON 2
              </div>
              <h1 className="font-display font-black text-base sm:text-lg leading-tight tracking-tight text-white">
                {myTeam?.name || 'My Team'} — War Room
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSquadExcel}
              disabled={mySquadPlayers.length === 0}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
              title="Download Squad Excel Sheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
            <button
              onClick={() => setShowSquadModal(true)}
              className="bg-[#2a0309] hover:bg-[#480712] text-[#ffd700] text-xs px-3 py-1.5 rounded-xl border border-[#cfa027]/60 font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" /> Squad ({squadSize}/{maxSquadSize})
            </button>
            {dbStatus?.activeSource === 'supabase' && (
              <span className="text-[10px] bg-indigo-900 border border-indigo-400 text-indigo-100 px-2 py-1 rounded-lg font-mono font-bold flex items-center gap-1 shadow">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>BACKUP DB</span>
              </span>
            )}
            <button
              onClick={logout}
              className="text-white/70 hover:text-white p-1.5 rounded-lg transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Purse & Reserve Meter - Clean Poster Theme */}
        <div className="max-w-4xl mx-auto mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="bg-[#2e040b] p-2 rounded-xl border border-emerald-400/30">
            <div className="text-[9px] uppercase tracking-wider text-[#e5bf5b] font-bold">Total Amount Left</div>
            <div className="text-sm sm:text-base font-black font-mono text-emerald-400">
              ₹ {purseRemaining.toLocaleString()}
            </div>
          </div>
          <div className="bg-[#2e040b] p-2 rounded-xl border border-[#cfa027]/25">
            <div className="text-[9px] uppercase tracking-wider text-slate-300 font-bold">Total Spent</div>
            <div className="text-xs sm:text-sm font-black font-mono text-white">
              ₹ {totalSpent.toLocaleString()}
            </div>
          </div>
          <div className="bg-[#2e040b] p-2 rounded-xl border border-[#cfa027]/25">
            <div className="text-[9px] uppercase tracking-wider text-[#e5bf5b] font-bold">Girls & Boys Status</div>
            <div className="text-xs sm:text-sm font-black font-mono text-[#ffd700] flex items-center justify-center gap-2">
              <span className={myGirlsCount >= 1 ? 'text-pink-400 font-bold' : 'text-slate-300'}>🎀 {myGirlsCount}/1</span>
              <span>•</span>
              <span className={myBoysCount >= 11 ? 'text-blue-400 font-bold' : 'text-slate-300'}>🏏 {myBoysCount}/11</span>
            </div>
          </div>
          <div className="bg-[#2e040b] p-2 rounded-xl border border-[#cfa027]/25">
            <div className="text-[9px] uppercase tracking-wider text-slate-300 font-bold">Squad Progress</div>
            <div className="text-xs sm:text-sm font-black font-mono text-white">
              {squadSize}/12 <span className="text-[10px] text-slate-400 font-normal">(15 max)</span>
            </div>
          </div>
        </div>

        {/* Team Bidding Lock Alert if Applicable */}
        {myTeamLockReason && (
          <div className="max-w-4xl mx-auto mt-2 bg-amber-500/20 border border-amber-400 text-amber-200 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs">
            <span>ℹ️</span>
            <span>{myTeamLockReason}</span>
          </div>
        )}
      </header>

      {/* Main Stage */}
      <main className="p-4 max-w-4xl mx-auto w-full space-y-4 flex-1">
        {/* Offline Auction Instructions Banner */}
        <div className="bg-[#fcf5e9] border border-[#cfa027] p-3 rounded-2xl flex items-center justify-between text-xs text-[#540816] font-bold shadow-sm">
          <span className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500 fill-current" />
            <span>OFFLINE HALL AUCTION: Raise your team paddle in the auditorium to bid!</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider bg-[#540816] text-[#ffd700] px-2.5 py-0.5 rounded-full">
            In-Person Event
          </span>
        </div>

        {currentPlayer && auction?.status === 'running' ? (
          <>
            {/* Leading Status Alert */}
            {isLeading ? (
              <div className="bg-emerald-50 border-2 border-emerald-600 p-3.5 rounded-2xl flex items-center justify-between text-emerald-800 font-bold text-sm shadow-sm animate-pulse">
                <span className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-emerald-600" />
                  YOUR TEAM IS CURRENTLY HIGHEST BIDDER!
                </span>
                <span className="font-mono text-lg font-black text-emerald-700">₹ {currentBid.toLocaleString()}</span>
              </div>
            ) : hasAnyBids ? (
              <div className="bg-white border border-[#cfa027]/40 p-3 rounded-xl flex items-center justify-between text-[#540816] text-xs font-bold shadow-sm">
                <span>Leading Bidder: <strong className="text-[#1c1917] font-extrabold">{auction?.currentBidderName}</strong></span>
                <span className="font-mono text-base text-[#540816] font-black">₹ {currentBid.toLocaleString()}</span>
              </div>
            ) : (
              <div className="bg-white border border-[#cfa027]/40 p-2.5 rounded-xl text-center text-xs text-[#645d57] font-semibold shadow-sm">
                Opening Base Price: <strong className="text-[#540816] font-mono font-bold">₹ {(currentPlayer.basePrice || 1000).toLocaleString()}</strong>
              </div>
            )}

            {/* Horizontal Player Card: Left Image + Right Details with Entrance Animation */}
            <div
              key={currentPlayer.id}
              className="bg-white border-2 border-[#cfa027]/40 rounded-3xl p-5 sm:p-6 shadow-card-lg relative overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-right-6 duration-500"
            >
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Left Side: Player Image Frame */}
                <div className="relative flex-shrink-0 flex flex-col items-center">
                  <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border-2 border-[#cfa027] shadow-md bg-[#f4efe6] relative">
                    {(() => {
                      const activePhoto = resolvePlayerPhoto(currentPlayer);
                      if (activePhoto && !failedImages[activePhoto]) {
                        return (
                          <img
                            key={activePhoto}
                            src={activePhoto}
                            alt={currentPlayer.name}
                            onError={() => setFailedImages(prev => ({ ...prev, [activePhoto]: true }))}
                            className="w-full h-full object-cover"
                          />
                        );
                      }

                      return (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#540816] to-[#3a040c] text-white">
                          <span className="text-5xl font-black font-display text-[#e5bf5b]">
                            {currentPlayer.name.charAt(0)}
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-[#e5bf5b] mt-1">
                            SPL Player
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="absolute -bottom-2.5 bg-[#540816] text-[#ffd700] border border-[#cfa027] px-3 py-0.5 rounded-full text-[11px] font-mono font-bold shadow">
                    #{currentPlayer.serialNo || currentPlayer.auctionOrder}
                  </div>
                </div>


                {/* Right Side: Player Details & Current Bid */}
                <div className="flex-1 w-full text-center sm:text-left pt-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                    <span className="bg-[#540816] text-[#ffd700] text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                      {currentPlayer.role}
                    </span>
                    {currentPlayer.category && (
                      <span className="bg-[#f4efe6] text-[#540816] border border-[#cfa027]/40 text-xs font-bold px-2.5 py-0.5 rounded-full">
                        {currentPlayer.category}
                      </span>
                    )}
                    {isFemalePlayer(currentPlayer) && (
                      <span className="bg-pink-700 text-white text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                        <span>🎀</span> FEMALE
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-display font-black text-[#540816] leading-tight">
                    {currentPlayer.name}
                  </h2>

                  <div className="text-xs text-[#645d57] font-semibold mt-1.5 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1">
                    <span>Batting: <strong className="text-[#1c1917]">{currentPlayer.battingStyle || 'Right Hand'}</strong></span>
                    <span className="text-[#cfa027]">•</span>
                    <span>Bowling: <strong className="text-[#1c1917]">{currentPlayer.bowlingStyle || 'Right Arm'}</strong></span>
                  </div>

                  {/* Big Live Bid Box */}
                  <div className="mt-3.5 bg-gradient-to-r from-[#fdfbf7] via-[#f7f2e7] to-[#fdfbf7] p-4 rounded-2xl border-2 border-[#cfa027]/50 shadow-sm">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-[#997316]">
                      Current Highest Bid
                    </div>
                    <div className="text-3xl sm:text-4xl font-black font-mono text-[#540816] mt-0.5">
                      ₹ {currentBid.toLocaleString()}
                    </div>
                    {auction?.announcement && (
                      <div className="text-xs text-[#730d20] font-bold mt-1">
                        {auction.announcement}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Bidding Activity for Current Player */}
            <div className="bg-white border border-[#cfa027]/30 rounded-2xl p-4 shadow-card">
              <h3 className="text-xs font-bold text-[#540816] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#cfa027]" /> Live Bidding War ({currentPlayer.name})
              </h3>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {recentBids.slice(0, 6).map(b => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs border transition ${
                      b.teamId === currentTeamId
                        ? 'bg-[#fcf5e9] border-[#cfa027] text-[#540816] font-bold shadow-sm'
                        : 'bg-[#faf8f4] border-[#e5ded1] text-[#1c1917]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TeamBadge team={{ badge: b.teamBadge, name: b.teamName }} className="w-6 h-6 rounded-md text-[10px]" />
                      <span className="font-semibold">{b.teamName}</span>
                      {b.teamId === currentTeamId && (
                        <span className="text-[9px] bg-[#540816] text-[#ffd700] font-black px-1.5 py-0.5 rounded">YOU</span>
                      )}
                    </div>
                    <span className="font-mono font-black text-emerald-700 text-sm">
                      ₹ {b.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
                {recentBids.length === 0 && (
                  <div className="text-center py-3 text-xs text-[#645d57] font-medium">
                    Awaiting first paddle raise for {currentPlayer.name}...
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {auction?.lastSoldPlayer ? (
              <div className={`p-6 rounded-3xl border-2 text-center space-y-3 shadow-card-lg ${
                auction.lastSoldPlayer.teamId === currentTeamId
                  ? 'bg-emerald-50 border-emerald-500'
                  : 'bg-white border-[#cfa027]/50'
              }`}>
                <div className="inline-block px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow bg-[#540816] text-[#ffd700]">
                  {auction.lastSoldPlayer.teamId === currentTeamId
                    ? 'CONGRATULATIONS! YOU WON THIS PLAYER!'
                    : auction.lastSoldPlayer.teamId
                    ? 'PLAYER SOLD'
                    : 'MARKED UNSOLD'}
                </div>

                <div className="text-3xl font-display font-black text-[#540816]">
                  {auction.lastSoldPlayer.name}
                </div>

                {auction.lastSoldPlayer.teamId ? (
                  <div className="bg-[#f8f6f0] p-4 rounded-2xl border border-[#cfa027]/40 space-y-1">
                    <div className="text-xs text-[#645d57] flex items-center justify-center gap-2">
                      <span>Recruited By:</span>
                      <TeamBadge team={{ badge: auction.lastSoldPlayer.teamBadge, name: auction.lastSoldPlayer.teamName }} className="w-6 h-6 rounded-md text-[10px]" />
                      <strong className="text-[#540816] font-bold text-sm">{auction.lastSoldPlayer.teamName}</strong>
                    </div>
                    <div className="text-xs text-[#645d57]">
                      Final Closing Price: <strong className="text-emerald-700 font-mono text-base font-black">₹{auction.lastSoldPlayer.amount.toLocaleString()}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-rose-700 font-semibold">
                    No bids placed. Player moved to Round 2.
                  </div>
                )}

                <div className="text-xs text-[#645d57] font-medium pt-1 flex items-center justify-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#cfa027]" />
                  <span>Waiting for Chief Auctioneer to call next player to the block...</span>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-[#cfa027]/40 rounded-3xl p-8 text-center space-y-4 shadow-card-lg">
                <img src={splBanner} alt="SPL Season 2" className="h-28 mx-auto rounded-xl border border-[#cfa027]/30 shadow-md object-contain" />
                <h2 className="text-2xl font-display font-black text-[#540816]">AUCTION ON STANDBY</h2>
                <p className="text-xs text-[#645d57] max-w-sm mx-auto font-medium leading-relaxed">
                  The stage is set. Waiting for the chief auctioneer to bring the next player to the block.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= MY RECRUITED SQUAD LIVE TABLE ================= */}
        <div className="bg-white border-2 border-[#cfa027]/40 rounded-3xl p-5 shadow-card-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e5ded1]">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#997316]">
                Team Roster
              </div>
              <h3 className="font-display font-black text-lg text-[#540816] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#cfa027]" />
                My Recruited Squad ({squadSize}/{maxSquadSize} Players)
              </h3>
            </div>

            <button
              onClick={handleDownloadSquadExcel}
              disabled={mySquadPlayers.length === 0}
              className="bg-[#540816] hover:bg-[#6e0b1f] disabled:opacity-40 text-[#ffd700] border border-[#cfa027] font-display font-black text-xs uppercase px-4 py-2 rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Squad Excel</span>
            </button>
          </div>

          {mySquadPlayers.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[#e5ded1]">
              <table className="w-full text-left text-xs text-[#1c1917]">
                <thead className="bg-[#540816] text-[#ffd700] uppercase tracking-wider border-b border-[#cfa027]">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Player Name</th>
                    <th className="p-2.5">Role</th>
                    <th className="p-2.5">Year</th>
                    <th className="p-2.5">Batting</th>
                    <th className="p-2.5">Bowling</th>
                    <th className="p-2.5 text-right">Price Bought</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5ded1]">
                  {mySquadPlayers.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-[#f8f6f0] transition">
                      <td className="p-2.5 font-mono font-bold text-[#540816]">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-sm text-[#1c1917]">{p.name}</td>
                      <td className="p-2.5">
                        <span className="bg-[#f4efe6] text-[#540816] px-2 py-0.5 rounded font-bold text-[11px]">
                          {p.role}
                        </span>
                      </td>
                      <td className="p-2.5 text-[#645d57]">{p.category || '4th Year'}</td>
                      <td className="p-2.5 text-[#645d57]">{p.battingStyle || 'Right Hand'}</td>
                      <td className="p-2.5 text-[#645d57]">{p.bowlingStyle || 'Right Arm Medium'}</td>
                      <td className="p-2.5 font-mono font-black text-emerald-700 text-sm text-right">
                        ₹ {(p.soldPrice || p.currentBid || 1000).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 bg-[#f8f6f0] rounded-xl border border-dashed border-[#cfa027]/40 text-xs text-[#645d57]">
              No players recruited yet. When you win a bid in the hall, your players will appear here automatically!
            </div>
          )}
        </div>
      </main>

      {/* "My Squad" Modal */}
      {showSquadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white border-2 border-[#cfa027] rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-gradient-to-r from-[#3e040d] via-[#540816] to-[#3e040d] text-white flex items-center justify-between border-b border-[#cfa027]/40">
              <div>
                <h3 className="font-display font-black text-base flex items-center gap-2 text-white">
                  <Shield className="w-4 h-4 text-[#ffd700]" />
                  {myTeam?.name} Squad
                </h3>
                <p className="text-xs text-[#e5bf5b]">
                  {squadSize} / {maxSquadSize} Recruited • Spent: ₹{totalSpent.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setShowSquadModal(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#f8f6f0]">
              {mySquadPlayers.length > 0 ? (
                mySquadPlayers.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#e5ded1] shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#cfa027]/40 bg-white flex items-center justify-center flex-shrink-0">
                        {(() => {
                          const sqPhoto = resolvePlayerPhoto(p);
                          if (sqPhoto) {
                            return <img src={sqPhoto} alt={p.name} className="w-full h-full object-cover" />;
                          }
                          return (
                            <div className="w-full h-full bg-[#540816] text-[#ffd700] flex items-center justify-center font-black text-xs">
                              {idx + 1}
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[#1c1917]">{p.name}</div>
                        <div className="text-xs text-[#645d57]">{p.role} • {p.category || '4th Year'}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-black text-emerald-700 text-sm">
                        ₹ {p.soldPrice?.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#997316] font-semibold">Recruited</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-[#645d57] text-xs">
                  No players recruited yet.
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-[#e5ded1] flex items-center justify-between text-xs">
              <div>
                <span className="text-[#645d57] font-semibold">Remaining Purse: </span>
                <strong className="text-emerald-700 font-mono text-sm font-black">₹ {purseRemaining.toLocaleString()}</strong>
              </div>
              <button
                onClick={handleDownloadSquadExcel}
                disabled={mySquadPlayers.length === 0}
                className="px-3 py-1.5 bg-[#540816] text-[#ffd700] rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
