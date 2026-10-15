import { useEffect, useState, useRef } from 'react';
import { db } from '../../services/firebase';
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  setDoc
} from 'firebase/firestore';
import {
  AUCTION_DOC_ID,
  initializeTeamsInFirestore,
  setActivePlayer,
  startTimer,
  pauseTimer,
  updateAnnouncement,
  markSold,
  markUnsold,
  resetFullAuction,
  updatePlayer,
  deletePlayer,
  addCustomPlayer,
  resetSingleTeam,
  placeBid,
  shuffleWaitingPlayers,
  pickRandomWaitingPlayer,
  getAdminCredentials,
  updateAdminCredentials,
  updateTeam,
  undoLastBid,
  undoLastSold,
  setAuctionPhase
} from '../../services/auction.service';
import {
  syncAllToSupabase,
  subscribeDbStatus,
  forceDatabaseSource,
  listenToAuctionState,
  listenToTeams,
  listenToPlayers,
  DbStatus
} from '../../services/supabaseMirror.service';
import { resolvePlayerPhoto, syncAllPlayerPhotosToFirestore, isFemalePlayer } from '../../utils/playerPhotoResolver';
import { AuctionState, BidLog } from '../../types/auction.types';
import { Player } from '../../types/player.types';
import { TeamInfo, INITIAL_TEAMS } from '../../data/teamsData';
import ExcelUploader from '../../components/ExcelUploader';
import TeamBadge from '../../components/TeamBadge';
import { sounds } from '../../utils/soundEffects';
import toast from 'react-hot-toast';
import {
  Gavel,
  Play,
  Pause,
  RotateCcw,
  Users,
  Trophy,
  Layers,
  Search,
  CheckCircle,
  XCircle,
  ExternalLink,
  ShieldAlert,
  LogOut,
  Copy,
  SkipForward,
  Activity,
  Flame,
  Edit2,
  Trash2,
  Plus,
  Image as ImageIcon,
  X,
  Shuffle,
  Dices,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  Check,
  Undo2,
  UserCheck,
  Palette,
  Upload,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import splBanner from '../../../image.png';

function compressImage(file: File, maxDim = 600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminDashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'auction' | 'players' | 'teams'>('auction');
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>(INITIAL_TEAMS);
  const [recentBids, setRecentBids] = useState<BidLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'female' | 'male'>('ALL');
  const [initLoading, setInitLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [shuffleLoading, setShuffleLoading] = useState(false);
  const [syncPhotoLoading, setSyncPhotoLoading] = useState(false);
  const [syncSupabaseLoading, setSyncSupabaseLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Player Editing & Creation State
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewPlayer, setIsNewPlayer] = useState(false);
  const [playerForm, setPlayerForm] = useState({
    serialNo: '',
    name: '',
    role: 'All-Rounder',
    category: '4th Year',
    battingStyle: 'Right Hand',
    bowlingStyle: 'Right Arm Medium',
    basePrice: 1000,
    photoUrl: ''
  });
  const [savingPlayer, setSavingPlayer] = useState(false);

  // Single Team Reset State
  const [singleResetTeam, setSingleResetTeam] = useState<TeamInfo | null>(null);
  const [customTeamPurse, setCustomTeamPurse] = useState<number>(100000);
  const [showTeamResetModal, setShowTeamResetModal] = useState(false);
  const [singleResetLoading, setSingleResetLoading] = useState(false);

  // Smart Gavel & Paddle State
  const [customJumpBid, setCustomJumpBid] = useState<number | ''>('');
  const [paddleIncrementMode, setPaddleIncrementMode] = useState<'auto' | 500 | 1000 | 2000 | 5000>('auto');
  const [biddingTeamId, setBiddingTeamId] = useState<string | null>(null);
  const isBiddingRef = useRef(false);

  // Admin Master Password Change Modal State
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [currentAdminPass, setCurrentAdminPass] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [showPassText, setShowPassText] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);

  // Team Edit State
  const [editingTeam, setEditingTeam] = useState<TeamInfo | null>(null);
  const [showTeamEditModal, setShowTeamEditModal] = useState(false);
  const [teamForm, setTeamForm] = useState({
    name: '',
    shortName: '',
    badge: '',
    logoUrl: '',
    color: '#1d4ed8',
    accentColor: '#d4af37',
    purseRemaining: 100000
  });
  const [savingTeam, setSavingTeam] = useState(false);

  // Squad Inspection Modal State
  const [inspectTeam, setInspectTeam] = useState<TeamInfo | null>(null);
  const [showSquadInspectModal, setShowSquadInspectModal] = useState(false);

  // Undo Action State
  const [undoLoading, setUndoLoading] = useState(false);

  useEffect(() => {
    const unsubStatus = subscribeDbStatus(setDbStatus);

    const unsubAuction = listenToAuctionState((data) => {
      setAuction(data);
    });

    const unsubTeams = listenToTeams((teamList) => {
      if (teamList && teamList.length > 0) {
        setTeams(teamList);
      }
    });

    const unsubPlayers = listenToPlayers((plist) => {
      const sorted = [...plist].sort((a, b) => (a.auctionOrder || 0) - (b.auctionOrder || 0));
      setAllPlayers(sorted);
    });

    return () => {
      unsubStatus();
      unsubAuction();
      unsubTeams();
      unsubPlayers();
    };
  }, []);

  const handleSyncToSupabase = async () => {
    setSyncSupabaseLoading(true);
    try {
      const res = await syncAllToSupabase();
      if (res.success) {
        toast.success(`⚡ Synced ${res.playersCount} players & ${res.teamsCount} teams to Supabase!`, { duration: 4000 });
      } else {
        toast.error(`Supabase sync issue: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(`Failed to sync to Supabase: ${err?.message || err}`);
    } finally {
      setSyncSupabaseLoading(false);
    }
  };

  // Listen to bids for active player: Update in-place so each team shows their current highest offer
  useEffect(() => {
    const targetPlayerId = auction?.currentPlayerId;
    if (!targetPlayerId) {
      setRecentBids([]);
      return;
    }

    const bidsQ = query(collection(db, 'bids'), orderBy('timestamp', 'desc'));
    const unsubBids = onSnapshot(bidsQ, (snap) => {
      const teamLatestBidMap = new Map<string, BidLog>();
      snap.forEach(d => {
        const item = d.data() as BidLog;
        if (item.playerId === targetPlayerId) {
          const existing = teamLatestBidMap.get(item.teamId);
          if (!existing || item.amount > existing.amount) {
            teamLatestBidMap.set(item.teamId, { id: d.id, ...item });
          }
        }
      });
      // Sort highest offer on top
      const uniqueBids = Array.from(teamLatestBidMap.values()).sort((a, b) => b.amount - a.amount);
      setRecentBids(uniqueBids);
    });

    return () => unsubBids();
  }, [auction?.currentPlayerId]);

  useEffect(() => {
    if (!auction?.currentPlayerId) {
      setCurrentPlayer(null);
      return;
    }
    const unsubPlayer = onSnapshot(doc(db, 'players', auction.currentPlayerId), (snap) => {
      if (snap.exists()) {
        setCurrentPlayer({ id: snap.id, ...snap.data() } as Player);
      }
    });
    return () => unsubPlayer();
  }, [auction?.currentPlayerId]);


  const handleInitTeams = async () => {
    if (!window.confirm('Initialize all 12 teams with ₹1,00,000 purse each in Firestore?')) return;
    setInitLoading(true);
    try {
      await initializeTeamsInFirestore();
      toast.success('All 12 Teams Initialized with ₹1,00,000 purse!');
    } catch (err: any) {
      toast.error('Error initializing teams: ' + err.message);
    } finally {
      setInitLoading(false);
    }
  };

  const handleResetAuction = async () => {
    const firstConfirm = window.confirm(
      'RESET ENTIRE AUCTION?\n\nThis will:\n• Give all 12 teams back ₹1,00,000\n• Clear all player assignments\n• Delete all bid history\n• Reset auction to IDLE state\n\nAre you sure?'
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      'FINAL CONFIRMATION:\n\nAll auction progress will be wiped clean.\nClick OK to confirm the FULL RESET.'
    );
    if (!secondConfirm) return;

    setResetLoading(true);
    try {
      await resetFullAuction();
      toast.success('Auction fully reset! All 12 teams restored to ₹1,00,000. Ready to start fresh.', { duration: 5000 });
    } catch (err: any) {
      toast.error('Reset failed: ' + err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleSelectPlayer = async (p: Player) => {
    try {
      await setActivePlayer(p);
      sounds.playBidChime();
      toast.success(`Player ${p.name} placed on the auction block!`);
      setActiveTab('auction');
    } catch (err: any) {
      toast.error('Failed to set active player: ' + err.message);
    }
  };

  const handleSold = async () => {
    if (!currentPlayer || !auction) return;
    if (!auction.currentBidderId) {
      toast.error('No team has bid on this player yet! Cannot mark as SOLD.');
      return;
    }

    if (!window.confirm(`Confirm and Close Bid: Sell ${currentPlayer.name} to ${auction.currentBidderName} for ₹${auction.currentBid.toLocaleString()}?`)) {
      return;
    }

    sounds.playSoldFanfare();
    try {
      await markSold({
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        playerRole: currentPlayer.role,
        playerPhotoUrl: currentPlayer.photoUrl,
        currentBid: auction.currentBid,
        currentBidderId: auction.currentBidderId,
        currentBidderName: auction.currentBidderName || 'Winning Team',
        currentBidderBadge: auction.currentBidderBadge || 'RTB'
      });
      toast.success(`SOLD to ${auction.currentBidderName} for ₹${auction.currentBid.toLocaleString()}! Click 'Next Player' to continue.`);
    } catch (err: any) {
      toast.error('Error marking sold: ' + err.message);
    }
  };

  const getNextCalculatedBid = () => {
    const currentBid = Number(auction?.currentBid || currentPlayer?.basePrice || 1000);
    const hasLeadingBidder = Boolean(auction?.currentBidderId);
    if (!hasLeadingBidder) return currentBid;

    if (paddleIncrementMode === 'auto') {
      return currentBid < 5000 ? currentBid + 500 : currentBid + 1000;
    }
    return currentBid + paddleIncrementMode;
  };

  const handleAdminPaddleBid = async (team: TeamInfo, forcedAmount?: number) => {
    if (!currentPlayer) {
      toast.error('No player is currently on the auction block!');
      return;
    }

    // Prevent duplicate clicks or rapid double taps
    if (isBiddingRef.current) return;

    // Prevent team from bidding against itself unless admin entered a manual jump bid
    if (team.id === auction?.currentBidderId && !forcedAmount) {
      toast.error(`[${team.badge || team.shortName}] ${team.name} already holds the highest bid of ₹${(auction?.currentBid || 1000).toLocaleString()}! Awaiting another team.`);
      return;
    }

    const currentBid = Number(auction?.currentBid || currentPlayer.basePrice || 1000);
    const hasLeadingBidder = Boolean(auction?.currentBidderId);

    let nextBidAmount: number;
    if (forcedAmount && forcedAmount > 0) {
      nextBidAmount = forcedAmount;
    } else if (!hasLeadingBidder) {
      nextBidAmount = currentBid;
    } else {
      if (paddleIncrementMode === 'auto') {
        const step = currentBid < 5000 ? 500 : 1000;
        nextBidAmount = currentBid + step;
      } else {
        nextBidAmount = currentBid + paddleIncrementMode;
      }
    }

    if (nextBidAmount <= currentBid && hasLeadingBidder) {
      toast.error(`Bid must exceed current highest bid of ₹${currentBid.toLocaleString()}`);
      return;
    }

    // Stage & Gender Threshold Rules
    const currentIsGirl = isFemalePlayer(currentPlayer);
    const phase = auction?.auctionPhase || 'girls';
    const teamRecruited = allPlayers.filter(p => p.soldToTeamId === team.id || p.soldToTeamName === team.name);
    const teamGirls = teamRecruited.filter(p => isFemalePlayer(p)).length;
    const teamBoys = teamRecruited.length - teamGirls;

    if (phase === 'girls') {
      const teamsWithoutGirl = teams.filter(tm => {
        const tmP = allPlayers.filter(p => p.soldToTeamId === tm.id || p.soldToTeamName === tm.name);
        return tmP.filter(p => isFemalePlayer(p)).length === 0;
      });
      if (teamGirls >= 1 && teamsWithoutGirl.length > 0) {
        toast.error(`[${team.badge || team.shortName}] ${team.name} already has 1 compulsory female player! (${teamsWithoutGirl.length} teams still need their female player)`);
        return;
      }
    } else if (phase === 'boys') {
      if (currentIsGirl) {
        toast.error(`Girls Auction is closed. Current auction is in Stage 2: Boys Auction.`);
        return;
      }
      const teamsUnder11Boys = teams.filter(tm => {
        const tmP = allPlayers.filter(p => p.soldToTeamId === tm.id || p.soldToTeamName === tm.name);
        const bCount = tmP.length - tmP.filter(p => isFemalePlayer(p)).length;
        return bCount < 11;
      });
      if (teamBoys >= 11 && teamsUnder11Boys.length > 0) {
        toast.error(`[${team.badge || team.shortName}] ${team.name} reached 11 boys threshold! (${teamsUnder11Boys.length} teams still reaching 11 boys)`);
        return;
      }
    }

    // Safety check on team purse: 12 compulsory, 15 max (slots 13-15 optional)
    const currentSquad = team.squadSize || 0;
    if (currentSquad >= 15) {
      toast.error(`${team.name} has reached the maximum squad limit of 15 players!`);
      return;
    }
    const compulsorySlotsNeeded = Math.max(0, 12 - currentSquad);
    const reserveFund = compulsorySlotsNeeded > 1 ? (compulsorySlotsNeeded - 1) * 1000 : 0;
    const maxSafeBid = Math.max(0, (team.purseRemaining || 0) - reserveFund);

    if (nextBidAmount > maxSafeBid) {
      toast.error(`Warning: ${team.name} safe max bid is ₹${maxSafeBid.toLocaleString()} (Needs ₹${reserveFund.toLocaleString()} reserve for compulsory 12 players)`);
      return;
    }

    isBiddingRef.current = true;
    setBiddingTeamId(team.id);

    try {
      await placeBid(
        currentPlayer.id,
        currentPlayer.name,
        team.id,
        team.name,
        team.badge || team.shortName,
        nextBidAmount
      );
      sounds.playBidChime();
      toast.success(`[${team.badge || team.shortName}] ${team.name} raised bid to ₹${nextBidAmount.toLocaleString()}!`);
      setCustomJumpBid('');
    } catch (err: any) {
      toast.error('Bid failed: ' + err.message);
    } finally {
      setTimeout(() => {
        isBiddingRef.current = false;
        setBiddingTeamId(null);
      }, 350);
    }
  };

  const getNextAppropriatePlayer = () => {
    const phase = auction?.auctionPhase || 'girls';
    if (phase === 'girls') {
      const waitingGirl = allPlayers.find(p => isFemalePlayer(p) && p.status === 'waiting');
      if (waitingGirl) return waitingGirl;
    } else if (phase === 'boys') {
      const waitingBoy = allPlayers.find(p => !isFemalePlayer(p) && p.status === 'waiting');
      if (waitingBoy) return waitingBoy;
    }
    return allPlayers.find(p => p.status === 'waiting');
  };

  const handleStartAuction = async () => {
    if (currentPlayer) {
      await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
        status: 'running',
        isTimerRunning: true,
        timerRemaining: 20,
        timerEndTime: Date.now() + 20000,
        announcement: `Auction is LIVE! Bidding for ${currentPlayer.name} (Base ₹${(currentPlayer.basePrice || 1000).toLocaleString()})`,
        lastUpdated: Date.now()
      }, { merge: true });
      sounds.playBidChime();
      toast.success('Auction is now LIVE!');
      return;
    }

    const nextP = getNextAppropriatePlayer();
    if (!nextP) {
      toast.error('No waiting players available for this stage!');
      return;
    }

    await setActivePlayer(nextP);
    await startTimer(20);
    sounds.playBidChime();
    toast.success(`Auction Started! ${nextP.name} is on the block!`);
  };

  const handleNextPlayer = async () => {
    const nextP = getNextAppropriatePlayer();
    if (!nextP) {
      toast.error('No more waiting players in queue for this stage!');
      return;
    }
    await setActivePlayer(nextP);
    sounds.playBidChime();
    toast.success(`Loaded ${nextP.name} to auction block!`);
  };

  const handleShuffleQueue = async () => {
    setShuffleLoading(true);
    try {
      const count = await shuffleWaitingPlayers();
      if (count === 0) {
        toast.error('No waiting players available to shuffle!');
      } else {
        sounds.playBidChime();
        toast.success(`🎲 Shuffled ${count} waiting players into unexpected random order!`, {
          icon: '🔀',
          duration: 4000
        });
      }
    } catch (err: any) {
      toast.error('Shuffle failed: ' + err.message);
    } finally {
      setShuffleLoading(false);
    }
  };

  const handleRandomNextPlayer = async () => {
    setShuffleLoading(true);
    try {
      const randomP = await pickRandomWaitingPlayer();
      if (!randomP) {
        toast.error('No waiting players available!');
      } else {
        sounds.playBidChime();
        toast.success(`🎲 Surprise Pick! ${randomP.name} is on the auction block!`, {
          icon: '✨',
          duration: 4000
        });
      }
    } catch (err: any) {
      toast.error('Failed to pick random player: ' + err.message);
    } finally {
      setShuffleLoading(false);
    }
  };

  const handleSyncPhotos = async () => {
    if (allPlayers.length === 0) {
      toast.error('No players loaded in database to sync photos!');
      return;
    }
    setSyncPhotoLoading(true);
    try {
      const count = await syncAllPlayerPhotosToFirestore(allPlayers);
      sounds.playBidChime();
      toast.success(`⚡ Linked and updated photos for ${count} players in Firestore!`, {
        duration: 4000
      });
    } catch (err: any) {
      toast.error('Photo sync failed: ' + err.message);
    } finally {
      setSyncPhotoLoading(false);
    }
  };


  const handleCopyCredentials = () => {
    const header = `SMVITM SPL SEASON 2 - TEAM CREDENTIALS\nStarting Purse: ₹1,00,000\nSquad Size: 15 Players\nLogin URL: http://localhost:5173/owner/login\n\n`;
    const body = INITIAL_TEAMS.map((t, i) => 
      `${i + 1}. ${t.name} (${t.badge || t.shortName})\n   Email: ${t.email}\n   Password: ${t.password}\n`
    ).join('\n');
    navigator.clipboard.writeText(header + body);
    toast.success('All 12 Team Logins Copied to Clipboard!');
  };

  const handleUnsold = async () => {
    if (!currentPlayer) return;
    try {
      await markUnsold(currentPlayer.id, currentPlayer.name);
      toast('Player marked UNSOLD', { icon: '⚪' });
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  // Player management handlers
  const handleOpenEdit = (p: Player) => {
    setEditingPlayer(p);
    setIsNewPlayer(false);
    setPlayerForm({
      serialNo: String(p.serialNo || p.auctionOrder || ''),
      name: p.name || '',
      role: p.role || 'All-Rounder',
      category: p.category || '4th Year',
      battingStyle: p.battingStyle || 'Right Hand',
      bowlingStyle: p.bowlingStyle || 'Right Arm Medium',
      basePrice: p.basePrice || 1000,
      photoUrl: p.photoUrl || resolvePlayerPhoto(p) || ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingPlayer(null);
    setIsNewPlayer(true);
    setPlayerForm({
      serialNo: String(allPlayers.length + 1),
      name: '',
      role: 'All-Rounder',
      category: '4th Year',
      battingStyle: 'Right Hand',
      bowlingStyle: 'Right Arm Medium',
      basePrice: 1000,
      photoUrl: ''
    });
    setIsEditModalOpen(true);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerForm.name.trim()) {
      toast.error('Player name is required!');
      return;
    }
    setSavingPlayer(true);
    try {
      if (isNewPlayer) {
        await addCustomPlayer({
          serialNo: playerForm.serialNo,
          name: playerForm.name.trim(),
          role: playerForm.role,
          category: playerForm.category,
          battingStyle: playerForm.battingStyle,
          bowlingStyle: playerForm.bowlingStyle,
          basePrice: Number(playerForm.basePrice) || 1000,
          photoUrl: playerForm.photoUrl.trim() || null,
          auctionOrder: allPlayers.length + 1
        });
        toast.success(`Player "${playerForm.name}" added successfully!`);
      } else if (editingPlayer) {
        await updatePlayer(editingPlayer.id, {
          serialNo: playerForm.serialNo,
          name: playerForm.name.trim(),
          role: playerForm.role,
          category: playerForm.category,
          battingStyle: playerForm.battingStyle,
          bowlingStyle: playerForm.bowlingStyle,
          basePrice: Number(playerForm.basePrice) || 1000,
          photoUrl: playerForm.photoUrl.trim() || null
        });
        toast.success(`Updated details for "${playerForm.name}"!`);
      }
      setIsEditModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to save player: ' + err.message);
    } finally {
      setSavingPlayer(false);
    }
  };

  const handleDeletePlayer = async (p: Player) => {
    if (!window.confirm(`Are you sure you want to delete player "${p.name}"?`)) return;
    try {
      await deletePlayer(p.id);
      toast.success(`Deleted ${p.name}`);
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const handleOpenTeamReset = (team: TeamInfo) => {
    setSingleResetTeam(team);
    setCustomTeamPurse(100000);
    setShowTeamResetModal(true);
  };

  const handleConfirmSingleTeamReset = async () => {
    if (!singleResetTeam) return;
    setSingleResetLoading(true);
    try {
      await resetSingleTeam(singleResetTeam.id, customTeamPurse);
      toast.success(`Reset ${singleResetTeam.name} purse to ₹${customTeamPurse.toLocaleString()}!`);
      setShowTeamResetModal(false);
    } catch (err: any) {
      toast.error('Error resetting team: ' + err.message);
    } finally {
      setSingleResetLoading(false);
    }
  };

  const handleSaveAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdminPass.trim()) {
      toast.error('Please enter current master password.');
      return;
    }
    if (!newAdminPass.trim() || newAdminPass.trim().length < 4) {
      toast.error('New password must be at least 4 characters.');
      return;
    }
    if (newAdminPass.trim() !== confirmAdminPass.trim()) {
      toast.error('New passwords do not match!');
      return;
    }

    setPasswordChangeLoading(true);
    try {
      await updateAdminCredentials(newAdminPass.trim(), currentAdminPass.trim());
      sounds.playBidChime();
      toast.success('Master admin password updated successfully! Stored in Firestore database.', {
        duration: 5000,
        icon: '🔑'
      });
      setShowAdminPasswordModal(false);
      setCurrentAdminPass('');
      setNewAdminPass('');
      setConfirmAdminPass('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update admin password');
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleUndoBid = async () => {
    if (!currentPlayer) {
      toast.error('No player currently on auction block.');
      return;
    }
    if (!auction?.currentBidderId) {
      toast.error('No bids placed on this player to undo.');
      return;
    }
    setUndoLoading(true);
    try {
      const res = await undoLastBid(currentPlayer.id);
      if (res.success) {
        sounds.playBidChime();
        toast.success(res.message, { icon: '↩️' });
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error('Undo bid failed: ' + err.message);
    } finally {
      setUndoLoading(false);
    }
  };

  const handleUndoLastSold = async () => {
    if (!auction?.lastSoldPlayer) {
      toast.error('No recent sale found to undo.');
      return;
    }
    const confirmUndo = window.confirm(
      `Reopen auction for ${auction.lastSoldPlayer.name}?\n\nThis will refund ₹${auction.lastSoldPlayer.amount.toLocaleString()} to ${auction.lastSoldPlayer.teamName} and reopen bidding on the live stage.`
    );
    if (!confirmUndo) return;

    setUndoLoading(true);
    try {
      const res = await undoLastSold();
      if (res.success) {
        sounds.playBidChime();
        toast.success(res.message, { icon: '↩️', duration: 5000 });
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error('Undo sold failed: ' + err.message);
    } finally {
      setUndoLoading(false);
    }
  };

  const handleOpenEditTeam = (team: TeamInfo) => {
    setEditingTeam(team);
    const existingLogo = team.logoUrl || (team.badge && (team.badge.startsWith('data:') || team.badge.startsWith('http') || team.badge.startsWith('/')) ? team.badge : '');
    const cleanBadgeText = team.badge && (team.badge.startsWith('data:') || team.badge.startsWith('http') || team.badge.startsWith('/'))
      ? (team.shortName || '')
      : (team.badge || team.shortName || '');
    setTeamForm({
      name: team.name || '',
      shortName: team.shortName || '',
      badge: cleanBadgeText,
      logoUrl: existingLogo,
      color: team.color || '#1d4ed8',
      accentColor: team.accentColor || '#d4af37',
      purseRemaining: team.purseRemaining ?? 100000
    });
    setShowTeamEditModal(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    if (!teamForm.name.trim()) {
      toast.error('Team name cannot be empty');
      return;
    }
    setSavingTeam(true);
    try {
      const finalLogo = teamForm.logoUrl.trim();
      const finalBadgeText = teamForm.badge.trim() || teamForm.shortName.trim();
      await updateTeam(editingTeam.id, {
        name: teamForm.name.trim(),
        shortName: teamForm.shortName.trim() || editingTeam.shortName,
        badge: finalLogo || finalBadgeText,
        logoUrl: finalLogo || null,
        color: teamForm.color,
        accentColor: teamForm.accentColor,
        purseRemaining: Number(teamForm.purseRemaining) || 0
      });
      sounds.playBidChime();
      toast.success(`Updated team ${teamForm.name}! Live across all screens.`, { icon: '🛡️' });
      setShowTeamEditModal(false);
    } catch (err: any) {
      toast.error('Failed to update team: ' + err.message);
    } finally {
      setSavingTeam(false);
    }
  };

  const handleOpenInspectSquad = (team: TeamInfo) => {
    setInspectTeam(team);
    setShowSquadInspectModal(true);
  };

  const filteredPlayers = allPlayers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || p.role.toLowerCase().includes(roleFilter.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesGender = genderFilter === 'ALL' || (genderFilter === 'female' ? isFemalePlayer(p) : !isFemalePlayer(p));
    return matchesSearch && matchesRole && matchesStatus && matchesGender;
  });

  return (
    <div className="min-h-screen bg-[#f8f6f0] text-[#1c1917] flex flex-col font-sans">
      {/* Top Navbar - Poster Palette: Deep Maroon & Gold */}
      <header className="bg-gradient-to-r from-[#3e040d] via-[#540816] to-[#3e040d] border-b-2 border-[#cfa027]/50 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-card-lg text-white">
        <div className="flex items-center gap-4">
          <img
            src={splBanner}
            alt="SMVITM SPL S2"
            className="h-11 rounded-lg border border-[#cfa027]/60 shadow object-contain bg-white"
          />
          <div>
            <div className="text-[10px] font-bold text-[#e5bf5b] uppercase tracking-widest">
              SMVITM PREMIER LEAGUE SEASON 2
            </div>
            <h1 className="font-display font-black text-lg text-white leading-tight tracking-tight">
              CHIEF AUCTIONEER CONSOLE
            </h1>
          </div>
        </div>

        {/* Tab Switcher - Crisp Professional Pill */}
        <div className="flex bg-[#2e040b] p-1 rounded-xl border border-[#cfa027]/30 text-xs font-bold">
          <button
            onClick={() => setActiveTab('auction')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'auction'
                ? 'bg-[#cfa027] text-[#3e040d] shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" /> Live Auction
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'players'
                ? 'bg-[#cfa027] text-[#3e040d] shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Players ({allPlayers.length})
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'teams'
                ? 'bg-[#cfa027] text-[#3e040d] shadow font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> 12 Teams
          </button>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-3">
          <a
            href="/display"
            target="_blank"
            rel="noreferrer"
            className="text-xs bg-[#2e040b] hover:bg-[#480712] text-[#ffd700] border border-[#cfa027]/60 px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold transition shadow"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open TV Arena View
          </a>
          <button
            onClick={() => setShowAdminPasswordModal(true)}
            className="text-xs bg-[#2e040b] hover:bg-[#480712] text-[#ffd700] border border-[#cfa027]/60 px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold transition shadow cursor-pointer active:scale-95"
            title="Change Master Admin Password in Database"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#ffd700]" />
            <span>Admin Password</span>
          </button>
          <button
            onClick={logout}
            className="text-xs text-rose-300 hover:text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* ================= TAB 1: LIVE AUCTION CONTROLS ================= */}
        {activeTab === 'auction' && (
          <div className="space-y-6">
            {/* ================= AUCTION PHASE CONTROLLER BANNER ================= */}
            <div className="bg-gradient-to-r from-[#540816] via-[#3a040c] to-[#540816] border-2 border-[#cfa027] p-4 rounded-2xl shadow-card-lg text-white flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 rounded-xl bg-white/10 border border-[#cfa027]/40 shadow-inner">
                  {auction?.auctionPhase === 'girls' ? '🎀' : auction?.auctionPhase === 'girls_round2' ? '🎀' : auction?.auctionPhase === 'boys' ? '🏏' : '🏆'}
                </span>
                <div>
                  <div className="text-[10px] text-[#ffd700] uppercase font-mono font-bold tracking-wider">
                    CURRENT AUCTION STAGE
                  </div>
                  <div className="text-base font-display font-black text-white flex items-center gap-2">
                    <span>
                      {(!auction?.auctionPhase || auction?.auctionPhase === 'girls') && 'STAGE 1: Girls Auction (1 Compulsory Girl per Team)'}
                      {auction?.auctionPhase === 'girls_round2' && 'STAGE 1 (Round 2): Remaining 3 Girls (Optional Bidding)'}
                      {auction?.auctionPhase === 'boys' && 'STAGE 2: Boys Auction (11 Threshold per Team)'}
                      {auction?.auctionPhase === 'open' && 'STAGE 3: Open Auction (Optional Slots up to 15)'}
                    </span>
                  </div>
                  <div className="text-xs text-[#e5bf5b] font-medium mt-0.5">
                    {(!auction?.auctionPhase || auction?.auctionPhase === 'girls') && 'Each team must acquire 1 female player. Once a team wins 1 girl, their paddle is locked until all 12 teams have 1 girl.'}
                    {auction?.auctionPhase === 'girls_round2' && 'Remaining 3 female players on the block. Any team can bid or you can close the girls auction to start boys.'}
                    {auction?.auctionPhase === 'boys' && 'Each team must reach 11 boys. Once a team reaches 11 boys, their paddle is locked until all 12 teams hit 11 boys.'}
                    {auction?.auctionPhase === 'open' && 'All compulsory thresholds met (1 girl + 11 boys = 12). Open bidding for optional slots 13, 14, 15.'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setAuctionPhase('girls')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm active:scale-95 ${
                    (!auction?.auctionPhase || auction?.auctionPhase === 'girls')
                      ? 'bg-[#ffd700] text-[#540816] shadow-md font-black border border-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                  title="Stage 1: 1 compulsory girl per team"
                >
                  🎀 Girls (Compulsory 1)
                </button>
                <button
                  onClick={() => setAuctionPhase('girls_round2')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm active:scale-95 ${
                    auction?.auctionPhase === 'girls_round2'
                      ? 'bg-[#ffd700] text-[#540816] shadow-md font-black border border-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                  title="Stage 1 Round 2: Remaining 3 girls"
                >
                  🎀 Girls (Remaining 3)
                </button>
                <button
                  onClick={() => setAuctionPhase('boys')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm active:scale-95 ${
                    auction?.auctionPhase === 'boys'
                      ? 'bg-[#ffd700] text-[#540816] shadow-md font-black border border-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                  title="Stage 2: 11 boys threshold per team"
                >
                  🏏 Boys (11 Threshold)
                </button>
                <button
                  onClick={() => setAuctionPhase('open')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm active:scale-95 ${
                    auction?.auctionPhase === 'open'
                      ? 'bg-[#ffd700] text-[#540816] shadow-md font-black border border-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                  title="Stage 3: Open auction up to 15 players"
                >
                  🏆 Open (15 Max)
                </button>
              </div>
            </div>

            {/* Master Auction Command Bar - Clean Poster Theme */}
            <div className="bg-white border-2 border-[#cfa027]/40 rounded-2xl p-4 shadow-card flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full ${auction?.status === 'running' ? 'bg-emerald-500 animate-pulse shadow-md' : 'bg-slate-400'}`} />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#997316] font-bold">Auction Engine Status</div>
                  <div className="text-sm font-display font-black text-[#540816] uppercase flex items-center gap-2">
                    {auction?.status === 'running' ? (
                      <span className="text-emerald-700 font-black">AUCTION IS LIVE & IN PROGRESS</span>
                    ) : (
                      <span className="text-[#645d57]">AUCTION STANDBY / PAUSED</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {auction?.status !== 'running' ? (
                  <button
                    onClick={handleStartAuction}
                    className="bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] font-display font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>START AUCTION NOW</span>
                  </button>
                ) : (
                  <button
                    onClick={() => pauseTimer()}
                    className="bg-[#f4efe6] hover:bg-[#ebdcc4] text-[#540816] border border-[#cfa027]/60 font-display font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl flex items-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    <span>PAUSE AUCTION</span>
                  </button>
                )}

                <button
                  onClick={handleNextPlayer}
                  className="bg-white hover:bg-[#f8f6f0] text-[#540816] border border-[#cfa027]/60 font-bold text-xs uppercase px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  title="Load next sequential player from queue"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Next</span>
                </button>

                <button
                  onClick={handleRandomNextPlayer}
                  disabled={shuffleLoading}
                  className="bg-gradient-to-r from-[#540816] to-[#7a0d24] hover:from-[#6e0b1f] hover:to-[#8c0f29] disabled:opacity-50 text-[#ffd700] border border-[#cfa027] font-bold text-xs uppercase px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95"
                  title="Pick an unexpected random waiting player immediately to the block"
                >
                  <Dices className={`w-3.5 h-3.5 ${shuffleLoading ? 'animate-spin' : ''}`} />
                  <span>🎲 Random Next</span>
                </button>

                <button
                  onClick={handleShuffleQueue}
                  disabled={shuffleLoading}
                  className="bg-[#f4efe6] hover:bg-[#ebdcc4] disabled:opacity-50 text-[#540816] border border-[#cfa027]/60 font-bold text-xs uppercase px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                  title="Randomly shuffle the entire waiting player queue order unexpectedly"
                >
                  <Shuffle className={`w-3.5 h-3.5 text-[#997316] ${shuffleLoading ? 'animate-spin' : ''}`} />
                  <span>🔀 Shuffle</span>
                </button>

                <button
                  onClick={handleSyncPhotos}
                  disabled={syncPhotoLoading}
                  className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs uppercase px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                  title="Auto-link & sync local player photos from /players/ folder to Firestore"
                >
                  <ImageIcon className={`w-3.5 h-3.5 ${syncPhotoLoading ? 'animate-spin' : ''}`} />
                  <span>{syncPhotoLoading ? 'Syncing...' : 'Sync Photos'}</span>
                </button>

                <button
                  onClick={handleSyncToSupabase}
                  disabled={syncSupabaseLoading}
                  className="bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold text-xs uppercase px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                  title="Mirror and replicate all Firestore data (players, teams, auction) into Supabase right now"
                >
                  <Database className={`w-3.5 h-3.5 ${syncSupabaseLoading ? 'animate-spin' : ''}`} />
                  <span>{syncSupabaseLoading ? 'Syncing...' : 'Sync Supabase'}</span>
                </button>

                {/* Dual-Database Status Pill with Clickable Manual Override */}
                <div
                  onClick={() => {
                    const next = dbStatus?.activeSource === 'firebase' ? 'supabase' : 'firebase';
                    forceDatabaseSource(next);
                    toast.success(`Active database switched to ${next.toUpperCase()}!`, { icon: '⚡' });
                  }}
                  className="hidden sm:flex items-center gap-2 bg-[#f4efe6] hover:bg-[#eae3d2] cursor-pointer px-3 py-2 rounded-xl border border-[#cfa027]/50 text-[11px] font-bold shadow-inner transition select-none"
                  title="Click to toggle active database between Firebase and Supabase"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${dbStatus?.firebaseHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    <span className={dbStatus?.activeSource === 'firebase' ? 'text-[#540816] font-black underline decoration-[#cfa027]' : 'text-slate-500'}>Firebase</span>
                  </div>
                  <span className="text-[#cfa027]/70 font-mono">⇄</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${dbStatus?.supabaseHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className={dbStatus?.activeSource === 'supabase' ? 'text-indigo-950 font-black underline decoration-indigo-500' : 'text-slate-500'}>Supabase</span>
                  </div>
                  <span className="text-[9px] bg-[#540816]/10 text-[#540816] px-1.5 py-0.5 rounded font-mono uppercase font-black">
                    {dbStatus?.activeSource || 'firebase'}
                  </span>
                </div>

                <button
                  onClick={handleCopyCredentials}
                  className="bg-[#f8f6f0] hover:bg-[#eee7d8] text-[#540816] border border-[#cfa027]/40 text-xs font-bold px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                  title="Copy 12 Team Logins to Clipboard"
                >
                  <Copy className="w-3.5 h-3.5 text-[#997316]" />
                  <span>Logins</span>
                </button>

                <button
                  onClick={handleResetAuction}
                  disabled={resetLoading}
                  className="bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                  title="Reset entire auction — clears all bids, player sales and restores team purses"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${resetLoading ? 'animate-spin' : ''}`} />
                  {resetLoading ? 'Resetting...' : 'RESET'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Columns: Current Player & Gavel Controls */}
              <div className="lg:col-span-7 space-y-5">
                {currentPlayer ? (
                  <div className="bg-white border-2 border-[#cfa027]/40 rounded-3xl p-6 shadow-card-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-[#540816] text-[#ffd700] text-xs px-4 py-1 rounded-bl-xl font-black uppercase tracking-wider shadow">
                      {currentPlayer.status}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 items-center">
                      <div className="relative flex-shrink-0">
                        {(() => {
                          const activePhoto = resolvePlayerPhoto(currentPlayer);
                          if (activePhoto && !failedImages[activePhoto]) {
                            return (
                              <img
                                key={activePhoto}
                                src={activePhoto}
                                alt={currentPlayer.name}
                                onError={() => setFailedImages(prev => ({ ...prev, [activePhoto]: true }))}
                                className="w-36 h-36 rounded-2xl object-cover ring-4 ring-[#cfa027]/40 shadow-md bg-[#f4efe6]"
                              />
                            );
                          }
                          return (
                            <div className="w-36 h-36 rounded-2xl bg-gradient-to-b from-[#540816] to-[#3a040c] ring-4 ring-[#cfa027]/40 flex flex-col items-center justify-center text-white shadow-md">
                              <span className="text-5xl font-black font-display text-[#e5bf5b]">
                                {currentPlayer.name.charAt(0)}
                              </span>
                              <span className="text-[10px] uppercase tracking-wider text-[#e5bf5b] mt-1 font-bold">SPL Star</span>
                            </div>
                          );
                        })()}

                        <div className="absolute -bottom-2 -right-2 bg-[#540816] text-[#ffd700] border border-[#cfa027] px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold shadow">
                          #{currentPlayer.serialNo || currentPlayer.auctionOrder}
                        </div>
                      </div>

                      <div className="flex-1 text-center sm:text-left">
                        <div className="inline-block bg-[#f4efe6] text-[#540816] border border-[#cfa027]/40 text-xs px-3 py-0.5 rounded-full font-bold uppercase tracking-wider mb-1">
                          {currentPlayer.role}
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-display font-black text-[#540816] leading-tight">
                          {currentPlayer.name}
                        </h2>
                        <div className="text-xs text-[#645d57] font-semibold mt-1 space-x-3">
                          <span>Batting: <strong className="text-[#1c1917]">{currentPlayer.battingStyle || 'Right Hand'}</strong></span>
                          <span>•</span>
                          <span>Bowling: <strong className="text-[#1c1917]">{currentPlayer.bowlingStyle || 'Right Arm'}</strong></span>
                        </div>

                        {/* Current Bid Display */}
                        <div className="mt-4 bg-[#f8f6f0] p-4 rounded-2xl border-2 border-[#cfa027]/40 shadow-sm">
                          <div className="text-[10px] uppercase tracking-wider text-[#997316] font-bold">Current Highest Bid</div>
                          <div className="text-4xl font-black text-[#540816] font-mono mt-0.5">
                            ₹ {(auction?.currentBid || currentPlayer.basePrice).toLocaleString()}
                          </div>
                          <div className="text-xs text-[#645d57] mt-1 flex items-center gap-1.5">
                            <span>Leading Team:</span>
                            <strong className="text-sm">
                              {auction?.currentBidderName ? (
                                <span className="text-[#540816] font-black">
                                  [{auction.currentBidderBadge || 'SPL'}] {auction.currentBidderName}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic font-medium">No bids yet (Opening Base: ₹1,000)</span>
                              )}
                            </strong>
                          </div>

                          {/* Leading Team Purse Left & Spent Status */}
                          {(() => {
                            const leadingTeam = teams.find(t => t.id === auction?.currentBidderId);
                            if (!leadingTeam) return null;
                            return (
                              <div className="mt-2.5 pt-2 border-t border-[#cfa027]/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="text-[#645d57]">
                                  Purse Left: <strong className="text-emerald-700 font-mono font-bold">₹ {(leadingTeam.purseRemaining || 0).toLocaleString()}</strong>
                                </span>
                                <span className="text-[#645d57]">
                                  Spent: <strong className="text-[#1c1917] font-mono">₹ {(leadingTeam.totalSpent || 0).toLocaleString()}</strong>
                                </span>
                                <span className="text-[#645d57]">
                                  Squad: <strong className="text-[#540816] font-mono">{leadingTeam.squadSize || 0} / 15</strong>
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Auctioneer Action Bar */}
                    <div className="mt-6 pt-5 border-t border-[#e5ded1] space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f8f6f0] p-3 rounded-2xl border border-[#cfa027]/30">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { sounds.playBidChime(); startTimer(15); }}
                            className="bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-sm"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" /> Start (15s)
                          </button>
                          <button
                            onClick={() => pauseTimer()}
                            className="bg-white hover:bg-[#f8f6f0] text-[#540816] border border-[#cfa027]/40 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                          >
                            <Pause className="w-3.5 h-3.5" /> Pause
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              sounds.playGavel();
                              updateAnnouncement(`Going ONCE for ₹${auction?.currentBid.toLocaleString()}...`);
                            }}
                            className="bg-white hover:bg-[#f8f6f0] text-[#540816] border border-[#cfa027]/50 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            Going Once
                          </button>
                          <button
                            onClick={() => {
                              sounds.playGavel();
                              updateAnnouncement(`Going TWICE for ₹${auction?.currentBid.toLocaleString()}...`);
                            }}
                            className="bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            Going Twice
                          </button>
                        </div>
                      </div>

                      {/* CONFIRM & CLOSE BID (SOLD) / UNSOLD */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          onClick={handleSold}
                          disabled={!auction?.currentBidderId}
                          className="h-16 bg-emerald-700 hover:bg-emerald-600 text-white font-display font-black text-sm uppercase rounded-2xl shadow-md flex flex-col items-center justify-center gap-0.5 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-base font-black">
                            <CheckCircle className="w-5 h-5 text-[#ffd700]" />
                            <span>CONFIRM & CLOSE BID</span>
                          </div>
                          <span className="text-[10px] text-emerald-100 font-bold">
                            {auction?.currentBidderName ? `Sell to ${auction.currentBidderName} (₹${auction.currentBid.toLocaleString()})` : 'Awaiting Bids'}
                          </span>
                        </button>
                        <button
                          onClick={handleUnsold}
                          className="h-16 bg-white hover:bg-rose-50 text-rose-700 border-2 border-rose-300 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
                        >
                          <XCircle className="w-5 h-5" /> CLOSE AS UNSOLD
                        </button>
                      </div>

                      {/* UNDO LAST BID (Mistake/Correction) */}
                      {auction?.currentBidderId && (
                        <button
                          onClick={handleUndoBid}
                          disabled={undoLoading}
                          className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-xs"
                          title="Mistaken paddle? Roll back to previous team or base price"
                        >
                          <Undo2 className="w-4 h-4 text-amber-700" />
                          <span>{undoLoading ? 'Rolling back bid...' : '↩️ UNDO LAST BID (Mistake / Wrong Paddle)'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border-2 border-[#cfa027]/40 rounded-3xl p-8 text-center space-y-4 shadow-card-lg">
                    {auction?.lastSoldPlayer ? (
                      <div className="bg-[#f8f6f0] border border-[#cfa027]/40 rounded-2xl p-6 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-[#540816]">
                          {auction.lastSoldPlayer.teamId ? 'RECENTLY RECRUITED' : 'RECENTLY MARKED UNSOLD'}
                        </div>
                        <div className="text-2xl font-display font-black text-[#540816]">
                          {auction.lastSoldPlayer.name}
                        </div>
                        {auction.lastSoldPlayer.teamId ? (
                          <div className="text-sm text-[#645d57]">
                            Recruited by <strong className="text-[#540816]">[{auction.lastSoldPlayer.teamBadge}] {auction.lastSoldPlayer.teamName}</strong> for <strong className="text-emerald-700 font-mono text-base font-black">₹{auction.lastSoldPlayer.amount.toLocaleString()}</strong>
                          </div>
                        ) : (
                          <div className="text-sm text-rose-700 font-medium">Passed without bids. Available in round 2.</div>
                        )}
                        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                          <button
                            onClick={handleNextPlayer}
                            className="bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] font-display font-black text-xs uppercase px-8 py-3 rounded-xl shadow-md inline-flex items-center gap-2 transition active:scale-95 cursor-pointer"
                          >
                            <SkipForward className="w-4 h-4" />
                            <span>LOAD NEXT PLAYER</span>
                          </button>
                          {auction.lastSoldPlayer.teamId && (
                            <button
                              onClick={handleUndoLastSold}
                              disabled={undoLoading}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-400 font-bold text-xs uppercase px-5 py-3 rounded-xl shadow-sm inline-flex items-center gap-2 transition active:scale-95 cursor-pointer"
                              title="Reopen auction for this player if marked sold by mistake"
                            >
                              <Undo2 className="w-4 h-4 text-amber-700" />
                              <span>{undoLoading ? 'Reopening...' : '↩️ REOPEN / UNDO SALE'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Gavel className="w-12 h-12 text-[#997316] mx-auto mb-3" />
                        <h3 className="text-xl font-display font-black text-[#540816]">No Player on the Auction Block</h3>
                        <p className="text-xs text-[#645d57] mt-1 max-w-md mx-auto">
                          Click below or select a player from the queue to start bidding.
                        </p>
                        <button
                          onClick={handleStartAuction}
                          className="mt-4 bg-[#540816] text-[#ffd700] border border-[#cfa027] font-black text-xs uppercase px-6 py-2.5 rounded-xl shadow transition"
                        >
                          Start First Player
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Bids Feed for Active Player */}
                <div className="bg-white border border-[#cfa027]/30 rounded-2xl p-5 shadow-card">
                  <h3 className="font-bold text-xs text-[#540816] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-[#cfa027]" />
                    Live Bid Activity Feed
                  </h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {recentBids.length > 0 ? (
                      recentBids.map(b => {
                        const isLeader = b.teamId === auction?.currentBidderId;
                        return (
                          <div
                            key={b.id || b.teamId}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-sm transition ${
                              isLeader
                                ? 'bg-[#fcf5e9] border-[#cfa027] ring-1 ring-[#cfa027] shadow-sm'
                                : 'bg-[#f8f6f0] border-[#e5ded1]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md bg-[#540816] text-[#ffd700] text-[10px] font-black flex items-center justify-center shadow-sm">
                                {b.teamBadge || 'SPL'}
                              </span>
                              <span className="font-bold text-[#1c1917]">{b.teamName}</span>
                              {isLeader && (
                                <span className="bg-[#540816] text-[#ffd700] text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                                  LEADING
                                </span>
                              )}
                            </div>
                            <div className="font-mono font-black text-emerald-700">
                              ₹ {b.amount.toLocaleString()}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-[#645d57] text-center py-4">No bids placed for this player yet. Tap a team paddle on the right to start!</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right 5 Columns: 12-Teams Fast Paddle Deck & Queue */}
              <div className="lg:col-span-5 space-y-4">
                {/* 12-Teams Fast Paddle Deck */}
                <div className="bg-white border-2 border-[#cfa027] rounded-3xl p-5 shadow-card-lg space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#e5ded1]">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#997316]">
                        Chief Auctioneer Paddle Bar
                      </div>
                      <h3 className="font-display font-black text-[#540816] text-base leading-tight">
                        1-Click Team Bidding Gavel
                      </h3>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-[#645d57]">Next Bid Step</div>
                      <div className="font-mono font-black text-sm text-[#540816]">
                        ₹ {getNextCalculatedBid().toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Increment Step Selector */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#645d57] font-semibold">Increment Mode:</span>
                      <span className="text-[11px] font-bold text-[#540816]">
                        {paddleIncrementMode === 'auto' ? (
                          Number(auction?.currentBid || 1000) < 5000 ? '+₹500 (Under ₹5K)' : '+₹1,000 (Above ₹5K)'
                        ) : `+₹${paddleIncrementMode.toLocaleString()}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaddleIncrementMode('auto')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                          paddleIncrementMode === 'auto'
                            ? 'bg-[#540816] text-[#ffd700] border-[#cfa027] shadow'
                            : 'bg-[#f8f6f0] text-[#1c1917] border-[#e5ded1] hover:bg-[#ebdcc4]'
                        }`}
                      >
                        Auto (500/1k)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaddleIncrementMode(500)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                          paddleIncrementMode === 500
                            ? 'bg-[#540816] text-[#ffd700] border-[#cfa027] shadow'
                            : 'bg-[#f8f6f0] text-[#1c1917] border-[#e5ded1] hover:bg-[#ebdcc4]'
                        }`}
                      >
                        +₹500
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaddleIncrementMode(1000)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                          paddleIncrementMode === 1000
                            ? 'bg-[#540816] text-[#ffd700] border-[#cfa027] shadow'
                            : 'bg-[#f8f6f0] text-[#1c1917] border-[#e5ded1] hover:bg-[#ebdcc4]'
                        }`}
                      >
                        +₹1,000
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaddleIncrementMode(2000)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                          paddleIncrementMode === 2000
                            ? 'bg-[#540816] text-[#ffd700] border-[#cfa027] shadow'
                            : 'bg-[#f8f6f0] text-[#1c1917] border-[#e5ded1] hover:bg-[#ebdcc4]'
                        }`}
                      >
                        +₹2,000
                      </button>
                    </div>

                    {/* Direct Jump Bid Input */}
                    <div className="pt-1 flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Jump Bid (e.g. 10000)"
                        value={customJumpBid}
                        onChange={e => setCustomJumpBid(e.target.value ? parseInt(e.target.value) : '')}
                        step="500"
                        className="flex-1 bg-[#f8f6f0] border border-[#e5ded1] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#540816]"
                      />
                      {customJumpBid && (
                        <span className="text-[11px] text-[#540816] font-bold">
                          Click team below to apply ₹{Number(customJumpBid).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 12-Teams Fast Click Grid (4 cols x 3 rows) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] uppercase tracking-wider text-[#645d57] font-bold flex items-center justify-between">
                      <span>Tap Team That Raised Paddle:</span>
                      <span className="text-[10px] text-emerald-700 font-bold">1-Click Live Gavel</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {teams.map(t => {
                        const isLeading = t.id === auction?.currentBidderId;
                        const tRecruited = allPlayers.filter(p => p.soldToTeamId === t.id || p.soldToTeamName === t.name);
                        const tGirls = tRecruited.filter(p => isFemalePlayer(p)).length;
                        const tBoys = tRecruited.length - tGirls;
                        const currentIsGirl = currentPlayer ? isFemalePlayer(currentPlayer) : false;
                        const phase = auction?.auctionPhase || 'girls';

                        let isPaddleLocked = false;
                        let lockBadge = '';

                        if (phase === 'girls') {
                          const teamsWithoutGirl = teams.filter(tm => {
                            const tmP = allPlayers.filter(p => p.soldToTeamId === tm.id || p.soldToTeamName === tm.name);
                            return tmP.filter(p => isFemalePlayer(p)).length === 0;
                          });
                          if (tGirls >= 1 && teamsWithoutGirl.length > 0) {
                            isPaddleLocked = true;
                            lockBadge = '1 Girl Met';
                          }
                        } else if (phase === 'boys') {
                          if (currentIsGirl) {
                            isPaddleLocked = true;
                            lockBadge = 'Girls Closed';
                          } else {
                            const teamsUnder11Boys = teams.filter(tm => {
                              const tmP = allPlayers.filter(p => p.soldToTeamId === tm.id || p.soldToTeamName === tm.name);
                              const bCount = tmP.length - tmP.filter(p => isFemalePlayer(p)).length;
                              return bCount < 11;
                            });
                            if (tBoys >= 11 && teamsUnder11Boys.length > 0) {
                              isPaddleLocked = true;
                              lockBadge = '11 Boys Met';
                            }
                          }
                        }

                        if ((t.squadSize || 0) >= 15) {
                          isPaddleLocked = true;
                          lockBadge = 'Full (15/15)';
                        }

                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleAdminPaddleBid(t, customJumpBid ? Number(customJumpBid) : undefined)}
                            disabled={!currentPlayer || biddingTeamId !== null || isPaddleLocked}
                            title={lockBadge ? `Locked: ${lockBadge}` : `Bid for ${t.name}`}
                            className={`p-2.5 rounded-xl border-2 text-left transition relative flex flex-col justify-between cursor-pointer active:scale-95 disabled:cursor-not-allowed ${
                              isPaddleLocked
                                ? 'bg-slate-100 border-slate-300 opacity-60'
                                : isLeading
                                ? 'bg-[#fcf5e9] border-[#cfa027] ring-2 ring-[#cfa027] shadow-md'
                                : 'bg-[#f8f6f0] border-[#e5ded1] hover:border-[#540816] hover:bg-white shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <TeamBadge team={t} className="w-7 h-7 rounded-lg text-[11px]" />
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenInspectSquad(t);
                                }}
                                className="font-mono text-[9px] font-bold text-[#540816] bg-white/90 hover:bg-[#540816] hover:text-[#ffd700] px-1.5 py-0.5 rounded border border-[#cfa027]/40 cursor-pointer transition shadow-xs flex items-center gap-0.5"
                                title="Click to view full squad (G: Girls, B: Boys)"
                              >
                                <Users className="w-2.5 h-2.5" />
                                <span>G:{tGirls}/1 • B:{tBoys}/11</span>
                              </span>
                            </div>

                            <div className="font-bold text-xs text-[#1c1917] truncate leading-tight">
                              {t.shortName} • {t.name.split(' ')[0]}
                            </div>

                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] font-mono font-bold text-emerald-700">
                                ₹ {(t.purseRemaining || 0).toLocaleString()}
                              </span>
                              {lockBadge && (
                                <span className="text-[8px] bg-slate-600 text-white font-bold px-1.5 py-0.5 rounded">
                                  🔒 {lockBadge}
                                </span>
                              )}
                            </div>

                            {isLeading && !isPaddleLocked && (
                              <div className="absolute -top-1.5 -right-1.5 bg-[#540816] text-[#ffd700] text-[8px] font-black px-1.5 py-0.2 rounded-full border border-[#cfa027] shadow">
                                LEADING
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Collapsible Upcoming Players Queue */}
                <div className="bg-white border border-[#cfa027]/35 rounded-2xl p-4 shadow-card max-h-[300px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display font-black text-[#540816] text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-[#cfa027]" />
                      Next Queue ({allPlayers.filter(p => p.status === 'waiting').length} Waiting)
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleShuffleQueue}
                        disabled={shuffleLoading}
                        className="bg-[#f4efe6] hover:bg-[#ebdcc4] disabled:opacity-50 text-[#540816] border border-[#cfa027]/50 text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-sm active:scale-95"
                        title="Randomly shuffle waiting player queue unexpectedly"
                      >
                        <Shuffle className={`w-3 h-3 text-[#997316] ${shuffleLoading ? 'animate-spin' : ''}`} />
                        <span>Shuffle</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('players')}
                        className="text-[11px] text-[#997316] hover:underline font-bold"
                      >
                        View All
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {allPlayers
                      .filter(p => p.status === 'waiting')
                      .slice(0, 15)
                      .map((p, idx) => {
                        const queuePhoto = resolvePlayerPhoto(p);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-[#f8f6f0] border border-[#e5ded1] hover:border-[#cfa027] transition"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg overflow-hidden border border-[#cfa027]/50 flex-shrink-0 bg-white">
                                {queuePhoto ? (
                                  <img src={queuePhoto} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-[#540816] text-[#ffd700] flex items-center justify-center font-bold text-xs">
                                    {p.name.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-xs text-[#1c1917] truncate max-w-[130px] flex items-center gap-1">
                                  <span>{p.name}</span>
                                  <span className="text-[10px] font-mono text-[#997316]">#{p.serialNo || p.auctionOrder || idx + 1}</span>
                                </div>
                                <div className="text-[10px] text-[#645d57]">{p.role}</div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleSelectPlayer(p)}
                              className="bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] font-bold px-2 py-1 rounded text-[11px] transition cursor-pointer shadow-sm"
                            >
                              Auction
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* 12 Teams Live Purses (Total Amount Left) - Full Width Status Bar */}
            <div className="bg-white border-2 border-[#cfa027]/40 rounded-2xl p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-black text-xs text-[#540816] uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#cfa027]" />
                  12 Teams Live Purses (Total Amount Left)
                </h3>
                <span className="text-[11px] text-[#645d57] font-mono">Starting: ₹1,00,000 | Max 15 Squad</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {teams.map(t => (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-xl border text-xs transition ${
                      t.id === auction?.currentBidderId
                        ? 'bg-[#fcf5e9] border-[#cfa027] ring-2 ring-[#cfa027]/40 shadow-sm'
                        : 'bg-[#f8f6f0] border-[#e5ded1] hover:border-[#cfa027]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <TeamBadge team={t} className="w-6 h-6 rounded text-[10px]" />
                      <span className="text-[10px] font-mono text-[#540816] font-bold">{t.squadSize || 0}/15</span>
                    </div>
                    <div className="font-bold text-[#1c1917] text-xs truncate" title={t.name}>{t.name}</div>
                    <div className="text-[10px] text-[#645d57] mt-1 flex justify-between items-center">
                      <span>Left:</span>
                      <strong className="text-emerald-700 font-mono text-xs">₹ {(t.purseRemaining || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: PLAYERS & EXCEL UPLOADER ================= */}
        {activeTab === 'players' && (
          <div className="space-y-6">
            <ExcelUploader onSuccess={() => {}} />

            {/* Quick Status Filter Pills & Unsold Round 2 Alert */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
                    statusFilter === 'ALL'
                      ? 'bg-[#540816] text-[#ffd700] border border-[#cfa027]'
                      : 'bg-white text-[#645d57] hover:bg-[#f4efe6] border border-[#e5ded1]'
                  }`}
                >
                  All Players ({allPlayers.length})
                </button>
                <button
                  onClick={() => setStatusFilter('waiting')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
                    statusFilter === 'waiting'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-[#645d57] hover:bg-amber-50 border border-[#e5ded1]'
                  }`}
                >
                  ⏳ Waiting ({allPlayers.filter(p => p.status === 'waiting').length})
                </button>
                <button
                  onClick={() => setStatusFilter('bidding')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
                    statusFilter === 'bidding'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-[#645d57] hover:bg-blue-50 border border-[#e5ded1]'
                  }`}
                >
                  🔴 Live on Block ({allPlayers.filter(p => p.status === 'bidding').length})
                </button>
                <button
                  onClick={() => setStatusFilter('sold')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
                    statusFilter === 'sold'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-[#645d57] hover:bg-emerald-50 border border-[#e5ded1]'
                  }`}
                >
                  ✅ Sold ({allPlayers.filter(p => p.status === 'sold').length})
                </button>
                <button
                  onClick={() => setStatusFilter('unsold')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
                    statusFilter === 'unsold'
                      ? 'bg-rose-700 text-white'
                      : 'bg-white text-[#645d57] hover:bg-rose-50 border border-[#e5ded1]'
                  }`}
                >
                  ❌ Unsold Pool ({allPlayers.filter(p => p.status === 'unsold').length})
                </button>

                <span className="text-[#cfa027] font-bold">|</span>

                <button
                  onClick={() => setGenderFilter(genderFilter === 'female' ? 'ALL' : 'female')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
                    genderFilter === 'female'
                      ? 'bg-pink-700 text-white font-black ring-2 ring-pink-400'
                      : 'bg-white text-pink-700 hover:bg-pink-50 border border-pink-200'
                  }`}
                >
                  🎀 Girls ({allPlayers.filter(p => isFemalePlayer(p)).length})
                </button>
                <button
                  onClick={() => setGenderFilter(genderFilter === 'male' ? 'ALL' : 'male')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
                    genderFilter === 'male'
                      ? 'bg-blue-700 text-white font-black ring-2 ring-blue-400'
                      : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                  }`}
                >
                  🏏 Boys ({allPlayers.filter(p => !isFemalePlayer(p)).length})
                </button>
              </div>

              {/* Unsold Round 2 Trigger Notification if Waiting is 0 */}
              {allPlayers.filter(p => p.status === 'waiting').length === 0 && allPlayers.filter(p => p.status === 'unsold').length > 0 && (
                <div className="bg-amber-100 border-2 border-amber-400 text-[#540816] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse shadow-sm">
                  <span>🏁 Regular Queue Finished!</span>
                  <button
                    onClick={() => setStatusFilter('unsold')}
                    className="underline hover:text-amber-900 cursor-pointer"
                  >
                    Click to view {allPlayers.filter(p => p.status === 'unsold').length} Unsold Players for Round 2 →
                  </button>
                </div>
              )}
            </div>

            {/* Search & Filter Bar + Add Player Button */}
            <div className="bg-white border border-[#cfa027]/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-card">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#997316]" />
                <input
                  type="text"
                  placeholder="Search player name, role, year..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#540816]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={genderFilter}
                  onChange={e => setGenderFilter(e.target.value as any)}
                  className="bg-[#f8f6f0] border border-[#e5ded1] text-[#1c1917] text-sm rounded-xl px-3 py-2.5 font-bold cursor-pointer"
                >
                  <option value="ALL">All Genders</option>
                  <option value="female">🎀 Girls ({allPlayers.filter(p => isFemalePlayer(p)).length})</option>
                  <option value="male">🏏 Boys ({allPlayers.filter(p => !isFemalePlayer(p)).length})</option>
                </select>

                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="bg-[#f8f6f0] border border-[#e5ded1] text-[#1c1917] text-sm rounded-xl px-3 py-2.5 font-medium cursor-pointer"
                >
                  <option value="ALL">All Roles</option>
                  <option value="Batsman">Batsmen</option>
                  <option value="Bowler">Bowlers</option>
                  <option value="All-Rounder">All-Rounders</option>
                  <option value="Wicket-Keeper">Wicket Keepers</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-[#f8f6f0] border border-[#e5ded1] text-[#1c1917] text-sm rounded-xl px-3 py-2.5 font-medium cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="waiting">Waiting</option>
                  <option value="bidding">In Auction</option>
                  <option value="sold">Sold</option>
                  <option value="unsold">Unsold</option>
                </select>

                <button
                  onClick={handleShuffleQueue}
                  disabled={shuffleLoading}
                  className="bg-[#f4efe6] hover:bg-[#ebdcc4] disabled:opacity-50 text-[#540816] border border-[#cfa027]/50 font-bold text-xs uppercase px-3.5 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  title="Randomly shuffle the sequence of all waiting players"
                >
                  <Shuffle className={`w-3.5 h-3.5 text-[#997316] ${shuffleLoading ? 'animate-spin' : ''}`} />
                  <span>🔀 Shuffle Sequence</span>
                </button>

                <button
                  onClick={handleSyncPhotos}
                  disabled={syncPhotoLoading}
                  className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs uppercase px-3.5 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  title="Auto-link & sync all 138 local player photos from /players/ folder into database"
                >
                  <ImageIcon className={`w-3.5 h-3.5 ${syncPhotoLoading ? 'animate-spin' : ''}`} />
                  <span>{syncPhotoLoading ? 'Syncing...' : 'Sync All Photos'}</span>
                </button>

                <button
                  onClick={handleOpenCreate}
                  className="bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] font-display font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Player</span>
                </button>
              </div>
            </div>

            {/* Players Table */}
            <div className="bg-white border border-[#cfa027]/30 rounded-2xl overflow-hidden shadow-card">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs text-[#1c1917]">
                  <thead className="bg-[#540816] text-[#ffd700] uppercase tracking-wider sticky top-0 backdrop-blur-md border-b border-[#cfa027]">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Photo</th>
                      <th className="p-3">Player Name</th>
                      <th className="p-3">Role & Year</th>
                      <th className="p-3">Batting Style</th>
                      <th className="p-3">Bowling Style</th>
                      <th className="p-3">Base Price</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Sold Info</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5ded1]">
                    {filteredPlayers.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-[#f8f6f0] transition">
                        <td className="p-3 font-mono font-bold text-[#540816]">{p.serialNo || idx + 1}</td>
                        <td className="p-3">
                          {(() => {
                            const tablePhoto = resolvePlayerPhoto(p);
                            return (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(p)}
                                title={`Click to upload or edit photo for ${p.name}`}
                                className="w-10 h-10 rounded-lg overflow-hidden border border-[#cfa027]/40 hover:border-[#540816] hover:ring-2 hover:ring-[#cfa027] bg-[#f4efe6] flex items-center justify-center flex-shrink-0 transition cursor-pointer group"
                              >
                                {tablePhoto ? (
                                  <img
                                    src={tablePhoto}
                                    alt={p.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <span className="font-display font-black text-[#540816] text-sm">
                                    {p.name.charAt(0)}
                                  </span>
                                )}
                              </button>
                            );
                          })()}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-sm text-[#1c1917] flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {isFemalePlayer(p) && (
                              <span className="text-[10px] bg-pink-100 text-pink-800 border border-pink-300 font-black px-1.5 py-0.2 rounded-full">
                                🎀 Girl
                              </span>
                            )}
                          </div>
                          {p.contact && <div className="text-[10px] text-[#645d57] font-mono">{p.contact}</div>}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="bg-[#f4efe6] text-[#540816] border border-[#cfa027]/40 px-2 py-0.5 rounded font-bold text-[11px]">
                              {p.role}
                            </span>
                            {p.category && (
                              <span className="text-[10px] text-[#645d57] font-medium">
                                {p.category}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-[#645d57]">{p.battingStyle || '-'}</td>
                        <td className="p-3 text-[#645d57]">{p.bowlingStyle || '-'}</td>
                        <td className="p-3 font-mono font-bold text-emerald-700">₹ {(p.basePrice || 1000).toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] ${
                            p.status === 'sold' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            p.status === 'bidding' ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse' :
                            p.status === 'unsold' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                            'bg-[#f4efe6] text-[#645d57] border border-[#e5ded1]'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {p.status === 'sold' ? (
                            <span className="text-[#540816] font-bold">
                              ₹ {p.soldPrice?.toLocaleString()} ({p.soldToTeamName})
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSelectPlayer(p)}
                              className={`font-bold px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-sm ${
                                p.status === 'unsold'
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700]'
                              }`}
                              title={p.status === 'unsold' ? 'Re-Auction this unsold player in Round 2' : 'Send to Auction Block'}
                            >
                              {p.status === 'unsold' ? '🔁 Re-Auction' : 'Auction'}
                            </button>
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="bg-[#f4efe6] hover:bg-[#ebdcc4] text-[#540816] border border-[#cfa027]/50 p-1.5 rounded-lg text-xs transition cursor-pointer shadow-sm"
                              title="Edit Player Details & Photo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePlayer(p)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 p-1.5 rounded-lg text-xs transition cursor-pointer shadow-sm"
                              title="Delete Player"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: 12 TEAMS & CREDENTIALS ================= */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            <div className="bg-white border-2 border-[#cfa027]/40 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-card">
              <div>
                <h2 className="text-xl font-display font-black text-[#540816] flex items-center gap-2">
                  <ShieldAlert className="text-[#cfa027] w-6 h-6" />
                  12 SMVITM SPL Teams & Credentials
                </h2>
                <p className="text-xs text-[#645d57] mt-1 font-medium">
                  Each team starts with ₹1,00,000 purse. Mandatory squad size: 15 players. You can reset teams individually or all together.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleCopyCredentials}
                  className="bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] font-bold px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition active:scale-95 cursor-pointer text-xs uppercase tracking-wider"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy All 12 Logins</span>
                </button>
                <button
                  onClick={handleInitTeams}
                  disabled={initLoading}
                  className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-5 py-2.5 rounded-xl shadow flex items-center gap-2 transition active:scale-95 cursor-pointer text-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{initLoading ? 'Resetting...' : 'Reset All 12 Teams'}</span>
                </button>
              </div>
            </div>

            {/* Teams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {teams.map(t => {
                const tRecruited = allPlayers.filter(p => p.soldToTeamId === t.id || p.soldToTeamName === t.name);
                const tGirls = tRecruited.filter(p => isFemalePlayer(p)).length;
                const tBoys = tRecruited.length - tGirls;
                const squadSize = t.squadSize || tRecruited.length;
                const neededGirls = Math.max(0, 1 - tGirls);
                const neededBoys = Math.max(0, 11 - tBoys);
                const compulsorySlotsNeeded = neededGirls + neededBoys;
                const reserveFund = compulsorySlotsNeeded > 1 ? (compulsorySlotsNeeded - 1) * 1000 : 0;
                const maxAffordableBid = squadSize >= 15 ? 0 : Math.max(0, (t.purseRemaining || 0) - reserveFund);

                return (
                  <div
                    key={t.id}
                    className="bg-white border-2 border-[#cfa027]/30 rounded-2xl p-5 shadow-card relative overflow-hidden flex flex-col justify-between"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: t.color || '#540816' }}
                    />

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <TeamBadge team={t} className="w-10 h-10 rounded-xl text-xs" />
                          <div>
                            <h3 className="font-display font-black text-[#540816] text-base leading-tight">{t.name}</h3>
                            <span className="text-[11px] font-mono text-[#997316] font-bold">{t.shortName}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-[#645d57] uppercase font-bold">Squad Progress</div>
                          <div className="font-black text-sm text-[#540816]">
                            {squadSize}/12 <span className="text-[10px] text-[#645d57] font-semibold">(15 max)</span>
                          </div>
                          <div className="text-[10px] font-bold mt-0.5">
                            <span className={tGirls >= 1 ? 'text-pink-700 font-bold' : 'text-slate-500'}>
                              🎀 {tGirls}/1 Girl
                            </span>
                            <span className="mx-1 text-slate-300">•</span>
                            <span className={tBoys >= 11 ? 'text-blue-700 font-bold' : 'text-slate-500'}>
                              🏏 {tBoys}/11 Boys
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Financial Stats */}
                      <div className="bg-[#f8f6f0] p-3 rounded-xl border border-[#e5ded1] mb-3 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#645d57]">Purse Remaining:</span>
                          <strong className="text-emerald-700 font-mono text-sm">
                            ₹ {(t.purseRemaining || 0).toLocaleString()}
                          </strong>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#645d57]">Total Spent:</span>
                          <span className="text-[#1c1917] font-mono">
                            ₹ {(t.totalSpent || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs pt-1 border-t border-[#e5ded1]">
                          <span className="text-[#997316] font-bold">Safe Max Bid:</span>
                          <strong className="text-[#540816] font-mono font-bold">
                            ₹ {maxAffordableBid.toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      {/* Login Info for Managers */}
                      <div className="bg-[#f4efe6] border border-[#cfa027]/30 p-2.5 rounded-lg text-xs space-y-1 mb-3">
                        <div className="text-[#645d57]">
                          Email: <strong className="text-[#1c1917] font-mono select-all">{t.email}</strong>
                        </div>
                        <div className="text-[#645d57]">
                          Pass: <strong className="text-[#540816] font-mono font-bold select-all">{t.password}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Team Action Buttons: View Squad, Edit, Reset */}
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-[#e5ded1]">
                      <button
                        onClick={() => handleOpenInspectSquad(t)}
                        className="py-2 px-2 bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                        title="View full player squad for this team"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Squad</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditTeam(t)}
                        className="py-2 px-2 bg-[#f4efe6] hover:bg-[#ebdcc4] text-[#540816] border border-[#cfa027]/50 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                        title="Edit team name, badge, colors, purse"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleOpenTeamReset(t)}
                        className="py-2 px-2 bg-amber-50 hover:bg-amber-100 text-[#540816] border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                        title="Reset purse for this team"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#997316]" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL: EDIT / CREATE PLAYER ================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-2 border-[#cfa027] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-8">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-display font-black text-xl text-[#540816] flex items-center gap-2 mb-1">
              <Edit2 className="w-5 h-5 text-[#cfa027]" />
              {isNewPlayer ? 'Add New Player to Auction' : `Edit Player: ${playerForm.name}`}
            </h3>
            <p className="text-xs text-[#645d57] mb-5">
              Update photo, player name, role, base price, and cricket styles.
            </p>

            <form onSubmit={handleSavePlayer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#540816] mb-1">
                    Serial No / ID
                  </label>
                  <input
                    type="text"
                    value={playerForm.serialNo}
                    onChange={e => setPlayerForm({ ...playerForm, serialNo: e.target.value })}
                    placeholder="e.g. 003"
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2.5 text-xs text-[#1c1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#540816]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#540816] mb-1">
                    Base Opening Price (₹)
                  </label>
                  <input
                    type="number"
                    value={playerForm.basePrice}
                    onChange={e => setPlayerForm({ ...playerForm, basePrice: parseInt(e.target.value) || 0 })}
                    placeholder="1000"
                    step="500"
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2.5 text-xs text-emerald-700 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#540816]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#540816] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={playerForm.name}
                  onChange={e => setPlayerForm({ ...playerForm, name: e.target.value })}
                  placeholder="e.g. Swaroop M S"
                  className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2.5 text-sm text-[#1c1917] font-bold focus:outline-none focus:ring-2 focus:ring-[#540816]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#540816] mb-1">
                    Role
                  </label>
                  <select
                    value={playerForm.role}
                    onChange={e => setPlayerForm({ ...playerForm, role: e.target.value })}
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2.5 text-xs text-[#1c1917] font-bold focus:outline-none focus:ring-2 focus:ring-[#540816]"
                  >
                    <option value="All-Rounder">All-Rounder</option>
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="Wicket-Keeper">Wicket-Keeper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#540816] mb-1">
                    Year of Study / Category
                  </label>
                  <input
                    type="text"
                    value={playerForm.category}
                    onChange={e => setPlayerForm({ ...playerForm, category: e.target.value })}
                    placeholder="e.g. 4th Year / Tier 1"
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2.5 text-xs text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#540816]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#540816] mb-1">
                    Batting Style
                  </label>
                  <select
                    value={playerForm.battingStyle}
                    onChange={e => setPlayerForm({ ...playerForm, battingStyle: e.target.value })}
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2.5 text-xs text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#540816]"
                  >
                    <option value="Right Hand">Right Hand</option>
                    <option value="Left Hand">Left Hand</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#540816] mb-1">
                    Bowling Style
                  </label>
                  <input
                    type="text"
                    value={playerForm.bowlingStyle}
                    onChange={e => setPlayerForm({ ...playerForm, bowlingStyle: e.target.value })}
                    placeholder="e.g. Right Arm Medium"
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2.5 text-xs text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#540816]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#540816]">
                    Player Photo (Upload Direct or Link)
                  </label>
                  {playerForm.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPlayerForm(prev => ({ ...prev, photoUrl: '' }))}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 transition"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {/* Upload Action Box */}
                <div className="p-3 bg-[#f8f6f0] border-2 border-dashed border-[#cfa027]/50 hover:border-[#cfa027] rounded-2xl transition flex items-center gap-3">
                  {/* Photo Preview Thumbnail */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-[#cfa027] bg-[#ede8dc] flex items-center justify-center flex-shrink-0 shadow-sm">
                    {playerForm.photoUrl ? (
                      <img
                        src={playerForm.photoUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  {/* Actions & info */}
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer px-3.5 py-1.5 bg-[#540816] hover:bg-[#6c0b1e] text-[#fbf8f3] text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm active:scale-95">
                        <Upload className="w-3.5 h-3.5 text-[#cfa027]" />
                        <span>Upload Photo from PC</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const compressed = await compressImage(file, 600, 0.82);
                              setPlayerForm(prev => ({ ...prev, photoUrl: compressed }));
                              toast.success('Photo chosen! Click "Save Player" to apply.');
                            } catch (err: any) {
                              toast.error('Failed to load image: ' + err.message);
                            }
                          }}
                        />
                      </label>
                      {playerForm.photoUrl?.startsWith('data:') && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          ✓ File Ready
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#645d57]">
                      JPG, PNG, WEBP. You can also specify an exact local path or web link below:
                    </p>
                  </div>
                </div>

                <div className="mt-2">
                  <input
                    type="text"
                    value={playerForm.photoUrl}
                    onChange={e => setPlayerForm({ ...playerForm, photoUrl: e.target.value })}
                    placeholder="e.g. /players/003_Swaroop_M_S.jpg or /Screenshot_...jpg or https://..."
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2.5 text-xs text-[#1c1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#540816]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#e5ded1]">
                {!isNewPlayer && editingPlayer ? (
                  <button
                    type="button"
                    onClick={() => {
                      const targetP = editingPlayer;
                      setIsEditModalOpen(false);
                      handleDeletePlayer(targetP);
                    }}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    title="Permanently remove this player"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Player</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#645d57] rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPlayer}
                    className="px-6 py-2 bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] rounded-xl text-xs font-display font-black uppercase tracking-wider shadow-md transition disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {savingPlayer ? 'Saving...' : 'Save Player Details'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SINGLE TEAM RESET ================= */}
      {showTeamResetModal && singleResetTeam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-amber-400 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowTeamResetModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <TeamBadge team={singleResetTeam} className="w-10 h-10 rounded-xl text-xs" />
              <div>
                <h3 className="font-display font-black text-lg text-[#540816] leading-tight">
                  Reset {singleResetTeam.name}
                </h3>
                <span className="text-xs text-[#645d57]">Isolated Team Purse Reset</span>
              </div>
            </div>

            <p className="text-xs text-[#645d57] mb-4">
              This action will restore <strong className="text-[#1c1917]">{singleResetTeam.name}</strong>'s purse and release any players currently purchased by this team back into the available auction pool.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-1.5">
                New Purse Balance (₹)
              </label>
              <input
                type="number"
                value={customTeamPurse}
                onChange={e => setCustomTeamPurse(parseInt(e.target.value) || 0)}
                step="5000"
                className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-3 text-base text-emerald-700 font-mono font-black focus:outline-none focus:ring-2 focus:ring-[#540816]"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setCustomTeamPurse(100000)}
                  className="px-2.5 py-1 bg-[#f4efe6] hover:bg-[#ebdcc4] text-[#540816] border border-[#cfa027]/40 rounded-lg text-[11px] font-bold"
                >
                  ₹1,00,000 (Default)
                </button>
                <button
                  type="button"
                  onClick={() => setCustomTeamPurse(50000)}
                  className="px-2.5 py-1 bg-[#f4efe6] hover:bg-[#ebdcc4] text-[#540816] border border-[#cfa027]/40 rounded-lg text-[11px] font-bold"
                >
                  ₹50,000
                </button>
                <button
                  type="button"
                  onClick={() => setCustomTeamPurse(200000)}
                  className="px-2.5 py-1 bg-[#f4efe6] hover:bg-[#ebdcc4] text-[#540816] border border-[#cfa027]/40 rounded-lg text-[11px] font-bold"
                >
                  ₹2,00,000
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e5ded1]">
              <button
                type="button"
                onClick={() => setShowTeamResetModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#645d57] rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleTeamReset}
                disabled={singleResetLoading}
                className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition shadow-md active:scale-95 disabled:opacity-50"
              >
                {singleResetLoading ? 'Resetting...' : 'Confirm Reset Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHANGE ADMIN PASSWORD ================= */}
      {showAdminPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#cfa027] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowAdminPasswordModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-[#540816] text-[#ffd700] border border-[#cfa027] flex items-center justify-center shadow-md">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-[#540816] leading-tight">
                  ADMIN MASTER PASSWORD
                </h3>
                <span className="text-xs text-[#645d57]">Stored permanently in Firestore Database</span>
              </div>
            </div>

            <p className="text-xs text-[#645d57] mb-5 leading-relaxed bg-[#f8f6f0] p-3 rounded-xl border border-[#e5ded1]">
              Update the master credential for the Chief Auctioneer console. Future logins will use this new password stored in the database.
            </p>

            <form onSubmit={handleSaveAdminPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-1.5">
                  Current Master Password
                </label>
                <div className="relative">
                  <input
                    type={showPassText ? 'text' : 'password'}
                    value={currentAdminPass}
                    onChange={e => setCurrentAdminPass(e.target.value)}
                    placeholder="Enter current password (e.g. spl#admin2026 or admin123)"
                    required
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl pl-10 pr-10 py-3 text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#540816] font-mono"
                  />
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#997316]" />
                  <button
                    type="button"
                    onClick={() => setShowPassText(!showPassText)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-1.5">
                  New Master Password
                </label>
                <div className="relative">
                  <input
                    type={showPassText ? 'text' : 'password'}
                    value={newAdminPass}
                    onChange={e => setNewAdminPass(e.target.value)}
                    placeholder="Enter new strong password"
                    required
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl pl-10 pr-10 py-3 text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#540816] font-mono"
                  />
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#997316]" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassText ? 'text' : 'password'}
                    value={confirmAdminPass}
                    onChange={e => setConfirmAdminPass(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl pl-10 pr-10 py-3 text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#540816] font-mono"
                  />
                  <Check className="w-4 h-4 absolute left-3.5 top-3.5 text-[#997316]" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e5ded1]">
                <button
                  type="button"
                  onClick={() => setShowAdminPasswordModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#645d57] rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordChangeLoading}
                  className="px-6 py-2.5 bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] rounded-xl text-xs font-display font-black uppercase tracking-wider shadow-md transition disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {passwordChangeLoading ? 'Saving to Database...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT TEAM DETAILS ================= */}
      {showTeamEditModal && editingTeam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#cfa027] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowTeamEditModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <TeamBadge
                team={{
                  name: teamForm.name,
                  shortName: teamForm.shortName,
                  badge: teamForm.badge,
                  logoUrl: teamForm.logoUrl,
                  color: teamForm.color
                }}
                className="w-14 h-14 rounded-2xl text-sm shadow-md"
              />
              <div>
                <h3 className="text-xl font-display font-black text-[#540816]">
                  Edit Team Details
                </h3>
                <p className="text-xs text-[#645d57] font-medium">
                  Update name, logo, colors, or purse for {editingTeam.name}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-1.5">
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamForm.name}
                  onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                  required
                  placeholder="e.g. Royal Challengers"
                  className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-3 text-sm text-[#1c1917] font-bold focus:outline-none focus:ring-2 focus:ring-[#540816]"
                />
              </div>

              {/* Direct Team Logo Upload Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#540816]">
                    Team Logo (Direct Upload from Device)
                  </label>
                  {teamForm.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setTeamForm(prev => ({ ...prev, logoUrl: '' }))}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 transition cursor-pointer"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>

                <div className="p-3 bg-[#f8f6f0] border-2 border-dashed border-[#cfa027]/50 hover:border-[#cfa027] rounded-2xl transition flex items-center gap-3">
                  <TeamBadge
                    team={{
                      name: teamForm.name,
                      shortName: teamForm.shortName,
                      badge: teamForm.badge,
                      logoUrl: teamForm.logoUrl,
                      color: teamForm.color
                    }}
                    className="w-14 h-14 rounded-xl text-xs shadow-sm"
                  />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer px-3.5 py-1.5 bg-[#540816] hover:bg-[#6c0b1e] text-[#fbf8f3] text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm active:scale-95">
                        <Upload className="w-3.5 h-3.5 text-[#cfa027]" />
                        <span>Upload Logo from PC</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const compressed = await compressImage(file, 300, 0.85);
                              setTeamForm(prev => ({ ...prev, logoUrl: compressed }));
                              toast.success('Team logo loaded! Click "Save Team Details" to apply.');
                            } catch (err: any) {
                              toast.error('Failed to load image: ' + err.message);
                            }
                          }}
                        />
                      </label>
                      {teamForm.logoUrl?.startsWith('data:') && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          ✓ Image Ready
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#645d57]">
                      PNG, JPG, SVG, WEBP. Shows live across TV Display, Team Manager, and Admin.
                    </p>
                  </div>
                </div>

                <div className="mt-2">
                  <input
                    type="text"
                    value={teamForm.logoUrl}
                    onChange={e => setTeamForm({ ...teamForm, logoUrl: e.target.value })}
                    placeholder="or paste image URL (https://...)"
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2 text-xs text-[#1c1917] font-mono focus:outline-none focus:ring-2 focus:ring-[#540816]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-1.5">
                    Short Name / Code
                  </label>
                  <input
                    type="text"
                    value={teamForm.shortName}
                    onChange={e => setTeamForm({ ...teamForm, shortName: e.target.value.toUpperCase() })}
                    required
                    placeholder="e.g. RCB"
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-3 text-sm text-[#1c1917] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#540816]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-1.5">
                    Badge / Logo Fallback Text
                  </label>
                  <input
                    type="text"
                    value={teamForm.badge}
                    onChange={e => setTeamForm({ ...teamForm, badge: e.target.value })}
                    placeholder="e.g. 🦁 or RCB"
                    className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-3 text-sm text-[#1c1917] font-bold focus:outline-none focus:ring-2 focus:ring-[#540816]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-1.5">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={teamForm.color}
                      onChange={e => setTeamForm({ ...teamForm, color: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer border border-[#e5ded1]"
                    />
                    <input
                      type="text"
                      value={teamForm.color}
                      onChange={e => setTeamForm({ ...teamForm, color: e.target.value })}
                      className="flex-1 bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2.5 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={teamForm.accentColor}
                      onChange={e => setTeamForm({ ...teamForm, accentColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer border border-[#e5ded1]"
                    />
                    <input
                      type="text"
                      value={teamForm.accentColor}
                      onChange={e => setTeamForm({ ...teamForm, accentColor: e.target.value })}
                      className="flex-1 bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-2.5 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#540816] mb-1.5">
                  Purse Balance Remaining (₹)
                </label>
                <input
                  type="number"
                  value={teamForm.purseRemaining}
                  onChange={e => setTeamForm({ ...teamForm, purseRemaining: Number(e.target.value) })}
                  required
                  min="0"
                  step="1000"
                  className="w-full bg-[#f8f6f0] border border-[#e5ded1] rounded-xl p-3 text-sm text-[#1c1917] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#540816]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e5ded1]">
                <button
                  type="button"
                  onClick={() => setShowTeamEditModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#645d57] rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTeam}
                  className="px-6 py-2.5 bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] rounded-xl text-xs font-display font-black uppercase tracking-wider shadow-md transition disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {savingTeam ? 'Saving to Database...' : 'Save Team Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: VIEW TEAM SQUAD ================= */}
      {showSquadInspectModal && inspectTeam && (() => {
        const recruitedPlayers = allPlayers.filter(
          p => p.soldToTeamId === inspectTeam.id || p.soldToTeamName === inspectTeam.name
        );
        const squadCount = recruitedPlayers.length;
        const compulsoryNeeded = Math.max(0, 12 - squadCount);

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border-2 border-[#cfa027] rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div
                className="p-5 sm:p-6 text-white relative flex items-center justify-between"
                style={{ backgroundColor: inspectTeam.color || '#540816' }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-white/15 border border-white/30 backdrop-blur-sm font-display font-black text-base flex items-center justify-center shadow">
                    {inspectTeam.badge || inspectTeam.shortName}
                  </span>
                  <div>
                    <h3 className="text-xl font-display font-black text-white leading-tight">
                      {inspectTeam.name}
                    </h3>
                    <div className="text-xs text-white/80 font-medium">
                      Squad Size: {squadCount}/12 Compulsory (15 max)
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowSquadInspectModal(false)}
                  className="text-white/80 hover:text-white p-2 rounded-xl bg-black/20 hover:bg-black/40 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats Bar */}
              <div className="bg-[#f8f6f0] border-b border-[#e5ded1] p-4 grid grid-cols-3 gap-3 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-[#e5ded1]">
                  <div className="text-[10px] text-[#645d57] uppercase font-bold">Purse Left</div>
                  <div className="font-display font-black text-emerald-700 text-sm">
                    ₹ {(inspectTeam.purseRemaining || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#e5ded1]">
                  <div className="text-[10px] text-[#645d57] uppercase font-bold">Total Spent</div>
                  <div className="font-display font-black text-[#540816] text-sm">
                    ₹ {(inspectTeam.totalSpent || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#e5ded1]">
                  <div className="text-[10px] text-[#645d57] uppercase font-bold">Status</div>
                  <div className="font-display font-black text-xs text-[#997316] truncate">
                    {squadCount >= 15 ? 'Squad Full (15/15)' : squadCount >= 12 ? 'Compulsory Complete' : `${compulsoryNeeded} needed for 12`}
                  </div>
                </div>
              </div>

              {/* Recruited Players List */}
              <div className="p-5 overflow-y-auto flex-1 space-y-2.5">
                {recruitedPlayers.length === 0 ? (
                  <div className="py-12 text-center text-[#645d57]">
                    <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold">No players recruited yet.</p>
                    <p className="text-xs text-[#8c827a] mt-1">
                      As this team wins bids, player details, photos, and sale amounts will show up here.
                    </p>
                  </div>
                ) : (
                  recruitedPlayers.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#e5ded1] hover:border-[#cfa027]/50 transition shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[#8c827a] w-5 text-center">
                          {idx + 1}
                        </span>
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#cfa027]/40 bg-[#f4efe6] flex items-center justify-center flex-shrink-0">
                          <img
                            src={resolvePlayerPhoto(p)}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#1c1917]">{p.name}</div>
                          <div className="text-xs text-[#645d57]">
                            {p.role} • {p.category} {p.battingStyle ? `• ${p.battingStyle}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-[#645d57] uppercase font-bold">Sold For</div>
                        <div className="font-mono font-bold text-sm text-[#540816]">
                          ₹ {(p.soldPrice || p.basePrice || 1000).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-[#f8f6f0] border-t border-[#e5ded1] flex items-center justify-end">
                <button
                  onClick={() => setShowSquadInspectModal(false)}
                  className="px-5 py-2 bg-[#540816] hover:bg-[#6e0b1f] text-[#ffd700] border border-[#cfa027] rounded-xl text-xs font-display font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
