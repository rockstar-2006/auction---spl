import { useEffect, useState, useRef } from 'react';
import { db } from '../services/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { AUCTION_DOC_ID } from '../services/auction.service';
import {
  listenToAuctionState,
  listenToTeams,
  listenToPlayers,
  subscribeDbStatus,
  DbStatus
} from '../services/supabaseMirror.service';
import { AuctionState, BidLog } from '../types/auction.types';
import { Player } from '../types/player.types';
import { TeamInfo, INITIAL_TEAMS } from '../data/teamsData';
import { sounds } from '../utils/soundEffects';
import splBanner from '../../image.png';
import { Trophy, Activity, Flame, Clock, Sparkles } from 'lucide-react';
import { resolvePlayerPhoto, isFemalePlayer } from '../utils/playerPhotoResolver';
import TeamBadge from '../components/TeamBadge';
import { motion, AnimatePresence } from 'framer-motion';

declare global {
  interface Window {
    confetti?: (opts?: any) => void;
  }
}

export default function DisplayScreen() {
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>(INITIAL_TEAMS);
  const [recentBids, setRecentBids] = useState<BidLog[]>([]);
  const [nextPlayer, setNextPlayer] = useState<Player | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const lastActivePlayerRef = useRef<Player | null>(null);
  const lastCelebratedSoldTimestampRef = useRef<number>(0);
  const prevBidRef = useRef<number>(0);
  const [bidPulse, setBidPulse] = useState(false);

  // Sold Stamp & Screen Crack Animation State
  const [showSoldStamp, setShowSoldStamp] = useState(false);
  const [soldPlayerInfo, setSoldPlayerInfo] = useState<{
    name: string;
    teamName: string;
    teamBadge: string;
    amount: number;
  } | null>(null);
  const [screenShake, setScreenShake] = useState(false);

  // 1. Resilient Listeners with Instant Automatic Supabase Failover
  useEffect(() => {
    const unsubStatus = subscribeDbStatus(setDbStatus);

    const unsubAuction = listenToAuctionState((data) => {
      setAuction(data);

      // Check if player sold to trigger God-Level 3D Stamp Slam & Screen Crack!
      if (data.lastSoldPlayer && data.lastSoldPlayer.teamId) {
        const soldTimestamp = data.lastSoldPlayer.timestamp || 1;
        if (soldTimestamp > lastCelebratedSoldTimestampRef.current) {
          lastCelebratedSoldTimestampRef.current = soldTimestamp;
          triggerGodLevelSoldCelebration({
            name: data.lastSoldPlayer.name,
            teamName: data.lastSoldPlayer.teamName,
            teamBadge: data.lastSoldPlayer.teamBadge || 'SPL',
            amount: data.lastSoldPlayer.amount
          });
        }
      }

      // Check if bid increased to trigger sound and visual pulse
      if (data.currentBid > prevBidRef.current && prevBidRef.current !== 0) {
        sounds.playBidChime();
        setBidPulse(true);
        setTimeout(() => setBidPulse(false), 700);
      }
      prevBidRef.current = data.currentBid;
    });

    const unsubTeams = listenToTeams((tlist) => {
      if (tlist && tlist.length > 0) {
        setTeams(tlist);
      }
    });

    const unsubPlayers = listenToPlayers((plist) => {
      const waiting = plist.find(p => p.status === 'waiting');
      setNextPlayer(waiting || null);
      setAllPlayers(plist);
    });

    return () => {
      unsubStatus();
      unsubAuction();
      unsubTeams();
      unsubPlayers();
    };
  }, []);

  // 2. Track Current Player from embedded auction payload, allPlayers cache or direct fetch
  useEffect(() => {
    if (!auction?.currentPlayerId) {
      setPlayer(null);
      return;
    }
    // High-performance optimization: If auction doc already embeds the currentPlayer, use it immediately (0 extra reads!)
    if (auction.currentPlayer && auction.currentPlayer.id === auction.currentPlayerId) {
      setPlayer(auction.currentPlayer);
      lastActivePlayerRef.current = auction.currentPlayer;
      return;
    }
    const found = allPlayers.find(p => p.id === auction.currentPlayerId);
    if (found) {
      setPlayer(found);
      lastActivePlayerRef.current = found;
    } else {
      const unsubPlayer = onSnapshot(doc(db, 'players', auction.currentPlayerId), (snap) => {
        if (snap.exists()) {
          const pdata = { id: snap.id, ...snap.data() } as Player;
          setPlayer(pdata);
          lastActivePlayerRef.current = pdata;
        }
      }, () => {});
      return () => unsubPlayer();
    }
  }, [auction?.currentPlayerId, auction?.currentPlayer, allPlayers]);


  // Is the player on screen officially SOLD?
  const isSold = Boolean(!auction?.currentPlayerId && auction?.lastSoldPlayer && auction.lastSoldPlayer.teamId);

  // Persistent player for 3-column stage: Keep active player OR the recently sold player!
  const displayPlayer: Player | null = player || (auction?.lastSoldPlayer ? {
    id: auction.lastSoldPlayer.id,
    serialNo: lastActivePlayerRef.current?.serialNo || '001',
    name: auction.lastSoldPlayer.name,
    role: auction.lastSoldPlayer.role || lastActivePlayerRef.current?.role || 'All-Rounder',
    category: lastActivePlayerRef.current?.category || '4th Year',
    battingStyle: lastActivePlayerRef.current?.battingStyle || 'Right Hand',
    bowlingStyle: lastActivePlayerRef.current?.bowlingStyle || 'Right Arm Medium',
    contact: '',
    photoUrl: auction.lastSoldPlayer.photoUrl || lastActivePlayerRef.current?.photoUrl || null,
    basePrice: lastActivePlayerRef.current?.basePrice || 1000,
    currentBid: auction.lastSoldPlayer.amount,
    status: 'sold',
    soldToTeamId: auction.lastSoldPlayer.teamId,
    soldToTeamName: auction.lastSoldPlayer.teamName,
    soldPrice: auction.lastSoldPlayer.amount,
    auctionOrder: lastActivePlayerRef.current?.auctionOrder || 0,
    createdAt: Date.now()
  } : null);

  const targetPlayerId = auction?.currentPlayerId || auction?.lastSoldPlayer?.id;

  // 5. Listen to Live Bids for Current or Sold Player (capped to 20 to protect quotas)
  useEffect(() => {
    if (!targetPlayerId) {
      setRecentBids([]);
      return;
    }
    const bidsQ = query(collection(db, 'bids'), orderBy('timestamp', 'desc'), limit(20));
    const unsubBids = onSnapshot(bidsQ, (snap) => {
      const blist: BidLog[] = [];
      snap.forEach(d => {
        const item = d.data() as BidLog;
        if (item.playerId === targetPlayerId) {
          blist.push(item);
        }
      });
      setRecentBids(blist);
    });
    return () => unsubBids();
  }, [targetPlayerId]);

  // Trigger God-Level Stamp Slam & Crack Animation
  const triggerGodLevelSoldCelebration = (info: {
    name: string;
    teamName: string;
    teamBadge: string;
    amount: number;
  }) => {
    setSoldPlayerInfo(info);
    setShowSoldStamp(true);
    setScreenShake(true);

    // Heavy bass physical gavel slam boom
    sounds.playHeavyGavelSlam();

    // Confetti fanfare
    setTimeout(() => {
      sounds.playSoldFanfare();
      if (typeof window !== 'undefined' && window.confetti) {
        window.confetti({
          particleCount: 250,
          spread: 130,
          origin: { y: 0.55 },
          colors: ['#be123c', '#cfa027', '#ffd700', '#540816', '#ffffff']
        });
      }
    }, 200);

    // Stop screen shake after impact
    setTimeout(() => setScreenShake(false), 600);

    // Auto-dismiss stamp overlay after 9 seconds, but player stays marked SOLD on the 3-column page!
    setTimeout(() => {
      setShowSoldStamp(false);
    }, 9000);
  };

  const winningTeamId = isSold ? auction?.lastSoldPlayer?.teamId : auction?.currentBidderId;
  const leadingTeam = teams.find(t => t.id === winningTeamId);

  // Keyboard shortcut: Press 'S' on Display Screen to test/replay stamp slam & crack
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
        triggerGodLevelSoldCelebration({
          name: displayPlayer?.name || 'Swaroop M S',
          teamName: leadingTeam?.name || 'Iron Panthers',
          teamBadge: leadingTeam?.badge || 'IRP',
          amount: displayPlayer?.currentBid || 4000
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayPlayer, leadingTeam]);

  // Map each team's highest offer/bid specifically for THIS player on the block
  const teamOffersOnCurrentPlayer: Record<string, number> = {};
  recentBids.forEach(b => {
    if (b.playerId === targetPlayerId) {
      if (!teamOffersOnCurrentPlayer[b.teamId] || b.amount > teamOffersOnCurrentPlayer[b.teamId]) {
        teamOffersOnCurrentPlayer[b.teamId] = b.amount;
      }
    }
  });

  // Ensure leading or winning team reflects the highest bid
  if (isSold && auction?.lastSoldPlayer) {
    teamOffersOnCurrentPlayer[auction.lastSoldPlayer.teamId] = auction.lastSoldPlayer.amount;
  } else if (auction?.currentBidderId && auction?.currentBid) {
    teamOffersOnCurrentPlayer[auction.currentBidderId] = auction.currentBid;
  }

  // Sorted teams for right-hand table: Teams with HIGHEST offers for this player float directly to the TOP!
  const sortedTeams = [...teams].sort((a, b) => {
    const offerA = teamOffersOnCurrentPlayer[a.id] || 0;
    const offerB = teamOffersOnCurrentPlayer[b.id] || 0;
    if (offerB !== offerA) {
      return offerB - offerA; // Highest offer on this player goes to top!
    }
    return (b.squadSize || 0) - (a.squadSize || 0);
  });

  return (
    <div
      className={`h-screen max-h-screen bg-[#f8f6f0] text-[#1c1917] flex flex-col justify-between overflow-hidden select-none font-sans relative ${
        screenShake ? 'animate-[shake_0.5s_cubic-bezier(.36,.07,.19,.97)_both]' : ''
      }`}
    >
      {/* Stadium Light FX */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#cfa027]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#540816]/10 rounded-full blur-3xl pointer-events-none" />

      {/* ================= 1. BROADCAST TOP HEADER ================= */}
      <header className="h-[12vh] flex-shrink-0 bg-gradient-to-r from-[#3e040d] via-[#540816] to-[#3e040d] border-b-4 border-[#cfa027] px-8 flex items-center justify-between text-white shadow-card-lg z-20">
        <div className="flex items-center gap-5">
          <img
            src={splBanner}
            alt="SMVITM SPL Season 2"
            className="h-14 rounded-xl border border-[#cfa027] shadow-lg object-contain bg-white p-0.5"
          />
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#e5bf5b] uppercase">
              SMVITM Presents • Shri Madhwa Vadiraja Institute of Technology & Management
            </div>
            <h1 className="text-2xl font-display font-black tracking-wider uppercase flex items-center gap-2 leading-none">
              <span className="text-white">SPL SEASON 2</span>
              <span className="text-[#ffd700]">—</span>
              <span className="text-[#ffd700] drop-shadow-md">
                MEGA AUCTION ARENA
              </span>
            </h1>
            <div className="text-[10px] text-white/80 font-semibold tracking-wider mt-0.5">
              ONE LEAGUE • ONE TEAM • ONE FAMILY
            </div>
          </div>
        </div>

        {/* Active Stage Indicator Badge for Broadcast Stage */}
        <div className="hidden xl:flex items-center gap-2.5 bg-[#2e040b] border-2 border-[#ffd700] px-4 py-2 rounded-xl shadow-md">
          <span className="text-xl">
            {(!auction?.auctionPhase || auction?.auctionPhase === 'girls') ? '🎀' : auction?.auctionPhase === 'girls_round2' ? '🎀' : auction?.auctionPhase === 'boys' ? '🏏' : '🏆'}
          </span>
          <div>
            <div className="text-[9px] text-[#ffd700] font-mono font-bold uppercase tracking-widest">
              AUCTION STAGE
            </div>
            <div className="text-xs font-display font-black text-white">
              {(!auction?.auctionPhase || auction?.auctionPhase === 'girls') && 'STAGE 1: GIRLS AUCTION (1 Compulsory Girl)'}
              {auction?.auctionPhase === 'girls_round2' && 'STAGE 1 (ROUND 2): REMAINING 3 GIRLS'}
              {auction?.auctionPhase === 'boys' && 'STAGE 2: BOYS AUCTION (11 Boys Threshold)'}
              {auction?.auctionPhase === 'open' && 'STAGE 3: OPEN AUCTION (Optional Slots 13-15)'}
            </div>
          </div>
        </div>

        {/* Global Progress & Live Arena Status */}
        <div className="flex items-center gap-5">
          <div className="text-right bg-[#2e040b] px-4 py-2 rounded-xl border border-[#cfa027]/40 shadow-inner">
            <div className="text-[10px] text-[#e5bf5b] font-bold uppercase tracking-wider">Players Recruited</div>
            <div className="text-xl font-mono font-black text-emerald-400">
              {auction?.soldCount || 0} <span className="text-xs text-white/60">/ {auction?.totalPlayers || 154}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerGodLevelSoldCelebration({
                name: displayPlayer?.name || 'Swaroop M S',
                teamName: leadingTeam?.name || 'Iron Panthers',
                teamBadge: leadingTeam?.badge || 'IRP',
                amount: displayPlayer?.currentBid || 4000
              });
            }}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#540816] to-[#780d22] hover:brightness-110 border-2 border-[#ffd700] text-[#ffd700] text-xs font-display font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95"
            title="Click to test / replay 3D SOLD stamp animation (or press 'S')"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#ffd700] fill-current" />
            <span>Test SOLD Stamp</span>
          </button>


          {dbStatus?.activeSource === 'supabase' && (
            <div className="px-3 py-1.5 rounded-xl bg-indigo-950/90 border border-indigo-400 text-indigo-200 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>SUPABASE FAILOVER ACTIVE</span>
            </div>
          )}

          <div className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6e0b1f] to-[#450510] border-2 border-[#ffd700] flex items-center gap-2.5 shadow-md">
            <span className={`w-3.5 h-3.5 rounded-full ${auction?.status === 'running' ? 'bg-[#ffd700] animate-ping' : 'bg-slate-400'}`} />
            <span className="font-display font-black tracking-widest uppercase text-xs text-white">
              {auction?.status === 'running' ? 'AUCTION LIVE' : 'ARENA STANDBY'}
            </span>
          </div>
        </div>
      </header>

      {/* ================= 2. MAIN 3-COLUMN BROADCAST STAGE ================= */}
      <main className="flex-1 min-h-[88vh] lg:h-[88vh] px-3 sm:px-6 py-4 flex items-center justify-center z-10 overflow-y-auto lg:overflow-hidden">
        {displayPlayer ? (
          <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch animate-in fade-in zoom-in-95 duration-300">
            {/* ── LEFT COLUMN: BIG PROMINENT PLAYER PHOTO & PROFILE ── */}
            <div className="col-span-12 lg:col-span-4 bg-white border-2 border-[#cfa027] rounded-3xl p-5 shadow-card-lg relative flex flex-col justify-between items-center text-center">
              {/* Role & Female Badges */}
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="bg-[#540816] text-[#ffd700] border border-[#cfa027] px-4 py-1 rounded-full text-xs font-display font-black uppercase tracking-wider shadow">
                    {displayPlayer.role}
                  </span>
                  {isFemalePlayer(displayPlayer) && (
                    <span className="bg-pink-700 text-white border border-pink-300 px-3 py-1 rounded-full text-xs font-display font-black uppercase tracking-wider shadow flex items-center gap-1">
                      <span>🎀</span>
                      <span>FEMALE</span>
                    </span>
                  )}
                </div>
                {displayPlayer.category && (
                  <span className="bg-[#f4efe6] text-[#540816] border border-[#cfa027]/40 px-3.5 py-1 rounded-full text-xs font-bold shadow-sm">
                    {displayPlayer.category}
                  </span>
                )}
              </div>

              {/* Framed Big Player Portrait */}
              <div className="relative my-auto w-full flex justify-center py-2">
                <div className="w-64 h-64 sm:w-72 sm:h-72 lg:w-80 lg:h-80 xl:w-88 xl:h-88 rounded-3xl overflow-hidden border-4 border-[#cfa027] shadow-2xl bg-[#f4efe6] relative flex items-center justify-center">
                  {(() => {
                    const resolvedPhoto = resolvePlayerPhoto(displayPlayer);
                    if (resolvedPhoto && !failedImages[resolvedPhoto]) {
                      return (
                        <img
                          key={resolvedPhoto}
                          src={resolvedPhoto}
                          alt={displayPlayer.name}
                          onError={() => setFailedImages(prev => ({ ...prev, [resolvedPhoto]: true }))}
                          className="w-full h-full object-cover object-top"
                        />
                      );
                    }
                    return (
                      <div className="w-full h-full bg-gradient-to-b from-[#540816] to-[#3a040c] flex flex-col items-center justify-center text-white">
                        <span className="text-8xl font-display font-black text-[#e5bf5b]">
                          {displayPlayer.name.charAt(0)}
                        </span>
                        <span className="text-xs uppercase font-bold tracking-widest text-[#e5bf5b] mt-3">
                          SPL Star Player
                        </span>
                      </div>
                    );
                  })()}

                  {/* REALISTIC RUBBER INK STAMP OVER PLAYER PHOTO WHEN SOLD */}
                  {isSold && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                      <div className="border-4 border-dashed border-[#b91c1c] bg-[#b91c1c]/25 backdrop-blur-[2px] text-[#b91c1c] font-display font-black text-5xl px-8 py-2 rounded-2xl -rotate-12 tracking-widest uppercase shadow-2xl animate-in zoom-in-75 duration-300 drop-shadow-[0_4px_8px_rgba(185,28,28,0.5)]">
                        SOLD!
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#540816] text-[#ffd700] border-2 border-[#cfa027] px-6 py-1 rounded-full text-sm font-mono font-black shadow-lg">
                  #{displayPlayer.serialNo || displayPlayer.auctionOrder || 'SPL'}
                </div>
              </div>

              {/* Base Price Chip */}
              <div className="w-full bg-[#f8f6f0] p-3 rounded-2xl border border-[#e5ded1] mt-2">
                <div className="text-[10px] uppercase font-bold text-[#645d57] tracking-wider">
                  Opening Base Price
                </div>
                <div className="text-2xl font-mono font-black text-[#540816]">
                  ₹ {(displayPlayer.basePrice || 1000).toLocaleString()}
                </div>
              </div>
            </div>

            {/* ── MIDDLE COLUMN: DETAILS & GIANT LIVE BID BOX ── */}
            <div className="col-span-12 lg:col-span-4 flex flex-col justify-between space-y-4">
              {/* Player Name & Style Ribbon */}
              <div className="bg-white border-2 border-[#cfa027]/40 rounded-3xl p-5 shadow-card text-center">
                <h2 className="text-3xl lg:text-4xl font-display font-black text-[#540816] tracking-tight uppercase leading-tight">
                  {displayPlayer.name}
                </h2>

                <div className="flex items-center justify-center gap-5 text-xs font-semibold text-[#1c1917] mt-3 bg-[#f8f6f0] px-5 py-2 rounded-xl border border-[#e5ded1]">
                  <div>
                    <span className="text-[#645d57]">Batting: </span>
                    <strong className="text-[#540816] font-bold">{displayPlayer.battingStyle || 'Right Hand'}</strong>
                  </div>
                  <span className="text-[#cfa027] font-black">•</span>
                  <div>
                    <span className="text-[#645d57]">Bowling: </span>
                    <strong className="text-[#540816] font-bold">{displayPlayer.bowlingStyle || 'Right Arm Medium'}</strong>
                  </div>
                </div>
              </div>

              {/* Giant Highest Bid Box with Pulse */}
              <div
                className={`bg-white border-3 border-[#cfa027] rounded-3xl p-6 shadow-card-lg text-center relative overflow-hidden transition-all duration-300 flex-1 flex flex-col justify-center ${
                  isSold
                    ? 'border-[#b91c1c] ring-4 ring-[#b91c1c]/25 bg-gradient-to-b from-[#fffbf0] via-white to-[#fffbf0]'
                    : bidPulse
                    ? 'ring-8 ring-[#cfa027]/50 scale-[1.02]'
                    : ''
                }`}
              >
                <div className="text-xs font-display font-black uppercase tracking-widest text-[#997316] mb-1 flex items-center justify-center gap-2">
                  {isSold ? (
                    <>
                      <Sparkles className="w-4 h-4 text-[#b91c1c] fill-current" />
                      <span className="text-[#b91c1c] font-black tracking-widest">PLAYER OFFICIALLY RECRUITED</span>
                      <Sparkles className="w-4 h-4 text-[#b91c1c] fill-current" />
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4 text-amber-500 fill-current" />
                      <span>CURRENT HIGHEST BID</span>
                      <Flame className="w-4 h-4 text-amber-500 fill-current" />
                    </>
                  )}
                </div>

                <div className={`text-7xl lg:text-8xl font-display font-black tracking-tight my-2 font-mono drop-shadow-sm leading-none ${isSold ? 'text-[#b91c1c]' : 'text-[#540816]'}`}>
                  ₹ {(isSold ? (auction?.lastSoldPlayer?.amount || displayPlayer.currentBid) : (auction?.currentBid || displayPlayer.basePrice)).toLocaleString()}
                </div>

                {/* Leading / Winning Team Spotlight */}
                <div className="mt-4 pt-4 border-t border-[#e5ded1]">
                  <div className={`text-[11px] uppercase tracking-wider mb-2 font-black ${isSold ? 'text-[#b91c1c]' : 'text-[#997316]'}`}>
                    {isSold ? 'Winning Franchise' : 'Leading Bidder'}
                  </div>

                  {leadingTeam ? (
                    <div
                      className="inline-flex items-center gap-3.5 px-6 py-2.5 rounded-2xl border-2 shadow-md transition"
                      style={{
                        backgroundColor: `${leadingTeam.color}15`,
                        borderColor: leadingTeam.color || '#540816'
                      }}
                    >
                      <TeamBadge
                        team={leadingTeam}
                        className="w-12 h-12 rounded-xl text-base shadow-md"
                      />
                      <div className="text-left">
                        <div className="text-2xl font-display font-black text-[#540816] leading-tight">
                          {leadingTeam.name}
                        </div>
                        <div className="text-xs text-[#645d57] font-mono">
                          {isSold ? 'Recruited For: ' : 'Current Offer: '}
                          <strong className="text-emerald-700 font-bold text-sm">
                            ₹ {(isSold ? (auction?.lastSoldPlayer?.amount || 0) : (auction?.currentBid || 1000)).toLocaleString()}
                          </strong> | Squad: {leadingTeam.squadSize}/15
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="inline-block bg-[#f8f6f0] border border-[#cfa027]/40 px-6 py-2 rounded-2xl text-[#645d57] font-bold text-xs italic">
                      Awaiting Opening Paddle from 12 Teams (Base: ₹1,000)
                    </div>
                  )}
                </div>

                {/* Announcement Ribbon */}
                {(isSold || auction?.announcement) && (
                  <div className={`mt-3 border text-xs font-bold px-4 py-1.5 rounded-xl shadow-sm ${
                    isSold ? 'bg-rose-50 border-rose-300 text-rose-900 font-black' : 'bg-[#fcf5e9] border-[#cfa027] text-[#540816]'
                  }`}>
                    {isSold
                      ? `HAMMER DOWN! ${displayPlayer.name} is SOLD to [${leadingTeam?.badge || 'SPL'}] ${leadingTeam?.name || 'Winning Team'} for ₹${(auction?.lastSoldPlayer?.amount || 0).toLocaleString()}!`
                      : auction?.announcement}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN: 12 TEAMS LIVE TABLE WITH FLOATING ANIMATION ── */}
            <div className="col-span-12 lg:col-span-4 bg-white border-2 border-[#cfa027] rounded-3xl p-4 shadow-card-lg flex flex-col justify-between overflow-hidden min-h-[420px] lg:min-h-0">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#e5ded1]">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#cfa027]" />
                  <span className="font-display font-black text-[#540816] text-xs uppercase tracking-wider">
                    {isSold ? `Final Bids • ${displayPlayer.name}` : `Bidding War • Offers for ${displayPlayer.name}`}
                  </span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSold ? 'text-rose-700' : 'text-emerald-700 animate-pulse'}`}>
                  {isSold ? '● Bidding Closed' : '● Live Offers'}
                </span>
              </div>

              {/* Floating Animated Team Rows with Authentic IPL Broadcast FLIP Physics */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5 relative">
                <AnimatePresence mode="popLayout" initial={false}>
                  {sortedTeams.map((t, idx) => {
                    const isLeading = t.id === (isSold ? auction?.lastSoldPlayer?.teamId : auction?.currentBidderId);
                    const offerAmount = teamOffersOnCurrentPlayer[t.id];
                    const tRecruited = allPlayers.filter(p => p.soldToTeamId === t.id || p.soldToTeamName === t.name);
                    const tGirls = tRecruited.filter(p => isFemalePlayer(p)).length;
                    const tBoys = tRecruited.length - tGirls;

                    return (
                      <motion.div
                        layout
                        layoutId={`team-row-${t.id}`}
                        key={t.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{
                          opacity: 1,
                          scale: isLeading ? 1.02 : 1,
                          zIndex: isLeading ? 20 : 1
                        }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{
                          layout: {
                            type: "spring",
                            stiffness: 380,
                            damping: 26,
                            mass: 0.85
                          },
                          opacity: { duration: 0.2 },
                          scale: { duration: 0.25 }
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs relative ${
                          isLeading
                            ? isSold
                              ? 'bg-rose-50 border-2 border-[#b91c1c] ring-2 ring-[#b91c1c]/40 shadow-xl'
                              : 'bg-gradient-to-r from-[#fff9ea] via-[#fcf5e9] to-[#fff3d6] border-2 border-[#cfa027] ring-2 ring-[#cfa027]/60 shadow-xl'
                            : offerAmount
                            ? 'bg-white border-[#cfa027]/40 shadow-sm'
                            : 'bg-[#f8f6f0] border-[#e5ded1] opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <motion.span
                            layout="position"
                            className={`font-mono text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isLeading
                                ? isSold
                                  ? 'bg-[#b91c1c] text-white'
                                  : 'bg-[#540816] text-[#ffd700]'
                                : 'text-[#645d57]'
                            }`}
                          >
                            {idx + 1}
                          </motion.span>
                          <TeamBadge
                            team={t}
                            className="w-7 h-7 rounded-lg text-[10px]"
                          />
                          <div className="truncate">
                            <div className="font-bold text-xs text-[#1c1917] truncate leading-tight flex items-center gap-1.5">
                              <span>{t.name}</span>
                              {isLeading && (
                                <motion.span
                                  initial={{ scale: 0.7, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                  className={`${isSold ? 'bg-[#b91c1c] text-white' : 'bg-[#540816] text-[#ffd700] border border-[#cfa027]'} text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase shadow-xs flex items-center gap-0.5`}
                                >
                                  {isSold ? 'SOLD TO' : '🔥 LEADING'}
                                </motion.span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#645d57] font-mono flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span>Squad: <strong className="text-[#540816]">{t.squadSize || tRecruited.length}/12</strong></span>
                              <span>•</span>
                              <span className={tGirls >= 1 ? 'text-pink-700 font-bold' : 'text-slate-400 font-medium'}>
                                🎀 {tGirls}/1
                              </span>
                              <span>•</span>
                              <span className={tBoys >= 11 ? 'text-blue-700 font-bold' : 'text-slate-400 font-medium'}>
                                🏏 {tBoys}/11
                              </span>
                              <span>•</span>
                              <span>Spent: <strong className="text-[#1c1917]">₹{(t.totalSpent || (100000 - (t.purseRemaining ?? 100000))).toLocaleString()}</strong></span>
                              <span>•</span>
                              <span>Left: <strong className="text-emerald-700 font-bold">₹{(t.purseRemaining ?? 100000).toLocaleString()}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 ml-2">
                          {offerAmount ? (
                            <>
                              <motion.div
                                key={`${t.id}-${offerAmount}`}
                                initial={{ scale: 1.25, y: -2 }}
                                animate={{ scale: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 450, damping: 20 }}
                                className={`font-mono font-black text-sm leading-tight ${isLeading ? (isSold ? 'text-[#b91c1c]' : 'text-[#540816]') : 'text-emerald-700'}`}
                              >
                                ₹ {offerAmount.toLocaleString()}
                              </motion.div>
                              <div className={`text-[9px] font-bold ${isLeading ? (isSold ? 'text-[#b91c1c] uppercase tracking-wider' : 'text-[#cfa027] uppercase tracking-wider') : 'text-[#645d57]'}`}>
                                {isLeading ? (isSold ? 'Winning Bid' : 'Current Offer') : 'Offered'}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-mono text-xs text-[#540816] font-bold leading-tight">
                                ₹{(t.purseRemaining ?? 100000).toLocaleString()}
                              </div>
                              <div className="text-[9px] text-[#645d57] font-medium">Purse Left</div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

            </div>
          </div>
        ) : (
          /* ── STANDBY STAGE: INITIAL TOURNAMENT SPLASH (BEFORE 1ST PLAYER) ── */
          <div className="w-full max-w-5xl bg-white border-2 border-[#cfa027] rounded-3xl p-8 shadow-card-lg text-center relative overflow-hidden animate-in fade-in duration-300">
            <div className="py-8 space-y-4">
              <img
                src={splBanner}
                alt="SPL Season 2"
                className="h-28 mx-auto rounded-2xl border-2 border-[#cfa027] shadow-md object-contain bg-white p-1"
              />
              <h2 className="text-4xl font-display font-black text-[#540816] uppercase tracking-wide">
                SMVITM SPL Season 2 Mega Auction
              </h2>
              <p className="text-sm text-[#645d57] max-w-lg mx-auto font-medium">
                The stage is set. Waiting for the chief auctioneer to bring the opening player to the auction block.
              </p>

              {nextPlayer && (
                <div className="inline-block bg-[#f8f6f0] border border-[#cfa027]/40 px-6 py-2.5 rounded-2xl text-xs text-[#540816] font-bold shadow-sm">
                  First Up on the Block: <strong className="text-[#1c1917] font-extrabold">{nextPlayer.name}</strong> ({nextPlayer.role})
                </div>
              )}
            </div>
          </div>
        )}
      </main>


      {/* ================= 4. REALISTIC 3D RUBBER "SOLD" STAMP SLAM OVERLAY ================= */}
      {showSoldStamp && soldPlayerInfo && (
        <div
          onClick={() => setShowSoldStamp(false)}
          className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer select-none bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200"
          title="Click anywhere to dismiss celebration"
        >
          {/* Genuine Weathered 3D Rubber Stamp */}
          <div className="relative transform animate-[stampSlam_0.35s_cubic-bezier(0.25,1,0.5,1)_forwards] filter drop-shadow-[0_25px_60px_rgba(185,28,28,0.7)]">
            <div className="border-8 border-double border-[#b91c1c] bg-[#fffbf0]/98 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden -rotate-12 max-w-xl mx-4">

              {/* Inner dashed rubber stamp contour */}
              <div className="border-2 border-dashed border-[#b91c1c] rounded-2xl p-6">
                <div className="text-xs uppercase font-display font-black tracking-widest text-[#b91c1c] mb-1">
                  ★ SMVITM PREMIER LEAGUE 2026 • OFFICIAL AUCTION RECORD ★
                </div>

                {/* Heavy Bold Rubber Stamp "SOLD!" Text */}
                <div className="text-8xl sm:text-9xl font-display font-black text-[#b91c1c] tracking-wider leading-none scale-y-110 drop-shadow-[0_6px_10px_rgba(185,28,28,0.4)] my-2">
                  SOLD!
                </div>

                <div className="mt-4 pt-3 border-t-2 border-dashed border-[#b91c1c]/60">
                  <div className="text-3xl sm:text-4xl font-display font-black text-[#540816] uppercase tracking-wide">
                    {soldPlayerInfo.name}
                  </div>
                  <div className="text-2xl sm:text-3xl font-display font-black text-[#b91c1c] mt-1.5 uppercase flex items-center justify-center gap-2.5">
                    <TeamBadge
                      team={leadingTeam || teams.find(t => t.name === soldPlayerInfo.teamName)}
                      className="w-9 h-9 rounded-xl text-sm"
                    />
                    <span>RECRUITED BY: {soldPlayerInfo.teamName}</span>
                  </div>
                  <div className="text-5xl sm:text-6xl font-mono font-black text-emerald-700 mt-2.5 drop-shadow-sm">
                    ₹ {soldPlayerInfo.amount.toLocaleString()}
                  </div>
                </div>

                <div className="text-[10px] text-[#645d57] font-semibold uppercase tracking-wider mt-3">
                  (Tap anywhere to dismiss)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded CSS for 3D Stamp Slam Physics & Screen Shake */}
      <style>{`
        @keyframes stampSlam {
          0% {
            opacity: 0;
            transform: scale(3.5) rotate(-35deg) translateY(-100px);
          }
          70% {
            opacity: 1;
            transform: scale(0.92) rotate(-10deg) translateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(-12deg) translateY(0);
          }
        }

        @keyframes shake {
          10%, 90% { transform: translate3d(-3px, 0, 0); }
          20%, 80% { transform: translate3d(5px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-6px, 0, 0); }
          40%, 60% { transform: translate3d(6px, 0, 0); }
        }
      `}</style>
    </div>
  );
}
