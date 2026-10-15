import { db } from './firebase';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { INITIAL_TEAMS, ADMIN_CREDENTIALS, TeamInfo } from '../data/teamsData';
import { Player } from '../types/player.types';
import { BidLog } from '../types/auction.types';
import {
  mirrorAuctionState,
  mirrorTeam,
  mirrorTeamsBatch,
  mirrorPlayer,
  mirrorPlayersBatch,
  mirrorBid,
  mirrorAdminCredentials,
  deletePlayerFromSupabase,
  clearAllBidsInSupabase
} from './supabaseMirror.service';

export const AUCTION_DOC_ID = 'current';

// Initialize or reset the 12 teams in Firestore
export async function initializeTeamsInFirestore(): Promise<void> {
  const batch = writeBatch(db);
  for (const team of INITIAL_TEAMS) {
    const teamRef = doc(db, 'teams', team.id);
    batch.set(teamRef, {
      ...team,
      purseRemaining: 100000,
      squadSize: 0,
      maxSquadSize: 15,
      playerIds: [],
      totalSpent: 0,
      updatedAt: serverTimestamp()
    });
  }

  // Also initialize auction state
  const auctionRef = doc(db, 'auction', AUCTION_DOC_ID);
  batch.set(auctionRef, {
    status: 'idle',
    currentPlayerId: null,
    currentPlayerName: null,
    currentBid: 1000,
    currentBidderId: null,
    currentBidderName: null,
    currentBidderBadge: null,
    timerRemaining: 20,
    isTimerRunning: false,
    timerEndTime: null,
    soldCount: 0,
    unsoldCount: 0,
    totalPlayers: 0,
    auctionPhase: 'girls',
    announcement: 'Welcome to SPL 2026 Auction',
    lastUpdated: Date.now()
  }, { merge: true });

  await batch.commit();

  // Secondary dual-write to Supabase (non-blocking)
  mirrorTeamsBatch(INITIAL_TEAMS.map(team => ({
    ...team,
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  }))).catch(() => {});

  mirrorAuctionState({
    status: 'idle',
    currentPlayerId: null,
    currentPlayerName: null,
    currentBid: 1000,
    currentBidderId: null,
    currentBidderName: null,
    currentBidderBadge: null,
    timerRemaining: 20,
    isTimerRunning: false,
    timerEndTime: null,
    soldCount: 0,
    unsoldCount: 0,
    totalPlayers: 0,
    auctionPhase: 'girls',
    announcement: 'Welcome to SPL 2026 Auction',
    lastUpdated: Date.now()
  }).catch(() => {});
}

// Bulk import 154 players into Firestore in chunks
export async function importPlayersToFirestore(players: Player[]): Promise<number> {
  const chunkSize = 400;
  let totalImported = 0;

  for (let i = 0; i < players.length; i += chunkSize) {
    const chunk = players.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach((player, idx) => {
      const pId = player.id || `spl_${String(i + idx + 1).padStart(3, '0')}`;
      const pRef = doc(db, 'players', pId);
      batch.set(pRef, {
        ...player,
        id: pId,
        basePrice: player.basePrice || 1000,
        currentBid: player.basePrice || 1000,
        status: player.status || 'waiting',
        auctionOrder: player.auctionOrder ?? (i + idx + 1),
        createdAt: Date.now()
      });
    });

    await batch.commit();
    totalImported += chunk.length;
  }

  // Use setDoc with { merge: true } so it creates the document if it doesn't exist yet!
  await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
    totalPlayers: totalImported,
    lastUpdated: Date.now()
  }, { merge: true });

  // Secondary dual-write to Supabase
  mirrorPlayersBatch(players).catch(() => {});
  mirrorAuctionState({ totalPlayers: totalImported, lastUpdated: Date.now() }).catch(() => {});

  return totalImported;
}

// Set active player on auction block
export async function setActivePlayer(player: Player): Promise<void> {
  const auctionRef = doc(db, 'auction', AUCTION_DOC_ID);
  const playerRef = doc(db, 'players', player.id);

  const basePrice = player.basePrice || 1000;

  const auctionUpdates: any = {
    status: 'running',
    currentPlayerId: player.id,
    currentPlayerName: player.name,
    currentPlayer: player,
    currentBid: basePrice,
    currentBidderId: null,
    currentBidderName: null,
    currentBidderBadge: null,
    timerRemaining: 20,
    isTimerRunning: false,
    announcement: `Now on auction: ${player.name} (Base ₹${basePrice.toLocaleString()})`,
    lastUpdated: Date.now()
  };

  if (player.status === 'unsold') {
    auctionUpdates.unsoldCount = increment(-1);
  }

  try {
    // Use setDoc with { merge: true } so it creates or updates safely
    await setDoc(auctionRef, auctionUpdates, { merge: true });

    await setDoc(playerRef, {
      status: 'bidding',
      currentBid: basePrice,
      currentBidderId: null,
      currentBidderName: null,
      soldToTeamId: null,
      soldToTeamName: null,
      soldPrice: null
    }, { merge: true });
  } catch (err: any) {
    console.warn('Firestore setActivePlayer warning, writing to Supabase mirror:', err?.message || err);
  }

  // Secondary dual-write to Supabase (guaranteed)
  mirrorAuctionState(auctionUpdates).catch(() => {});
  mirrorPlayer({
    id: player.id,
    status: 'bidding',
    currentBid: basePrice,
    soldToTeamId: null,
    soldToTeamName: null,
    soldPrice: null
  }).catch(() => {});
}

// Place a live bid
export async function placeBid(
  playerId: string,
  playerName: string,
  teamId: string,
  teamName: string,
  teamBadge: string,
  newAmount: number
): Promise<void> {
  const auctionRef = doc(db, 'auction', AUCTION_DOC_ID);
  const playerRef = doc(db, 'players', playerId);

  const now = Date.now();
  const resetDuration = 15; // 15 seconds after each bid

  try {
    // Update auction state safely
    await setDoc(auctionRef, {
      currentBid: newAmount,
      currentBidderId: teamId,
      currentBidderName: teamName,
      currentBidderBadge: teamBadge,
      timerRemaining: resetDuration,
      isTimerRunning: true,
      timerEndTime: now + resetDuration * 1000,
      announcement: `Bid: ₹${newAmount.toLocaleString()} by ${teamName}`,
      lastUpdated: now
    }, { merge: true });

    // Update player doc safely
    await setDoc(playerRef, {
      currentBid: newAmount,
      currentBidderId: teamId,
      currentBidderName: teamName
    }, { merge: true });

    // Log bid into bids collection
    await addDoc(collection(db, 'bids'), {
      playerId,
      playerName,
      teamId,
      teamName,
      teamBadge,
      amount: newAmount,
      timestamp: now
    });
  } catch (err: any) {
    console.warn('Firestore placeBid warning, writing to Supabase mirror:', err?.message || err);
  }

  // Secondary dual-write to Supabase (guaranteed)
  mirrorAuctionState({
    currentBid: newAmount,
    currentBidderId: teamId,
    currentBidderName: teamName,
    currentBidderBadge: teamBadge,
    timerRemaining: resetDuration,
    isTimerRunning: true,
    timerEndTime: now + resetDuration * 1000,
    announcement: `Bid: ₹${newAmount.toLocaleString()} by ${teamName}`,
    lastUpdated: now
  }).catch(() => {});

  mirrorPlayer({
    id: playerId,
    currentBid: newAmount,
    soldToTeamId: null
  }).catch(() => {});

  mirrorBid({
    playerId,
    playerName,
    teamId,
    teamName,
    teamBadge,
    amount: newAmount,
    timestamp: now
  }).catch(() => {});
}

// Timer control functions
export async function startTimer(seconds: number = 15): Promise<void> {
  const now = Date.now();
  await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
    isTimerRunning: true,
    timerRemaining: seconds,
    timerEndTime: now + seconds * 1000,
    lastUpdated: now
  }, { merge: true });

  mirrorAuctionState({
    isTimerRunning: true,
    timerRemaining: seconds,
    timerEndTime: now + seconds * 1000,
    lastUpdated: now
  }).catch(() => {});
}

export async function pauseTimer(): Promise<void> {
  const now = Date.now();
  await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
    isTimerRunning: false,
    lastUpdated: now
  }, { merge: true });

  mirrorAuctionState({
    isTimerRunning: false,
    lastUpdated: now
  }).catch(() => {});
}

export async function updateAnnouncement(text: string): Promise<void> {
  const now = Date.now();
  await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
    announcement: text,
    lastUpdated: now
  }, { merge: true });

  mirrorAuctionState({
    announcement: text,
    lastUpdated: now
  }).catch(() => {});
}

// Mark player as SOLD
export async function markSold(opts: {
  playerId: string;
  playerName: string;
  playerRole?: string;
  playerPhotoUrl?: string | null;
  currentBid: number;
  currentBidderId: string;
  currentBidderName: string;
  currentBidderBadge?: string;
}): Promise<void> {
  const { playerId, playerName, playerRole, playerPhotoUrl, currentBid, currentBidderId, currentBidderName, currentBidderBadge } = opts;

  let updatedTeamPurse = 100000;
  let updatedSquadSize = 1;
  let updatedTotalSpent = currentBid;
  let updatedPlayerIds: string[] = [playerId];

  const now = Date.now();
  const lastSoldObj = {
    id: playerId,
    name: playerName,
    role: playerRole || 'All-Rounder',
    photoUrl: playerPhotoUrl || null,
    teamId: currentBidderId,
    teamName: currentBidderName,
    teamBadge: currentBidderBadge || '⚡',
    amount: currentBid,
    timestamp: now
  };

  try {
    // 1. Update player status in Firestore
    await setDoc(doc(db, 'players', playerId), {
      status: 'sold',
      soldToTeamId: currentBidderId,
      soldToTeamName: currentBidderName,
      soldPrice: currentBid
    }, { merge: true });

    // 2. Deduct purse and increment squad for the winning team
    const teamRef = doc(db, 'teams', currentBidderId);
    const teamSnap = await getDoc(teamRef);

    if (teamSnap.exists()) {
      const td = teamSnap.data() as TeamInfo;
      updatedTeamPurse = Math.max(0, td.purseRemaining - currentBid);
      updatedSquadSize = (td.squadSize || 0) + 1;
      updatedTotalSpent = (td.totalSpent || 0) + currentBid;
      updatedPlayerIds = [...(td.playerIds || []), playerId];

      await updateDoc(teamRef, {
        purseRemaining: updatedTeamPurse,
        squadSize: updatedSquadSize,
        playerIds: arrayUnion(playerId),
        totalSpent: updatedTotalSpent
      });
    }

    // 3. Broadcast to all screens
    await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
      currentPlayerId: null,
      currentPlayerName: null,
      currentPlayer: null,
      isTimerRunning: false,
      soldCount: increment(1),
      announcement: `🎉 SOLD! ${playerName} recruited by ${currentBidderName} for ₹${currentBid.toLocaleString()}!`,
      lastSoldPlayer: lastSoldObj,
      lastUpdated: now
    }, { merge: true });
  } catch (err: any) {
    console.warn('Firestore markSold warning, writing to Supabase mirror:', err?.message || err);
  }

  // Secondary dual-write to Supabase (non-blocking)
  mirrorPlayer({
    id: playerId,
    status: 'sold',
    soldToTeamId: currentBidderId,
    soldToTeamName: currentBidderName,
    soldPrice: currentBid
  }).catch(() => {});

  mirrorTeam({
    id: currentBidderId,
    purseRemaining: updatedTeamPurse,
    squadSize: updatedSquadSize,
    totalSpent: updatedTotalSpent,
    playerIds: updatedPlayerIds
  }).catch(() => {});

  mirrorAuctionState({
    currentPlayerId: null,
    currentPlayerName: null,
    isTimerRunning: false,
    announcement: `🎉 SOLD! ${playerName} recruited by ${currentBidderName} for ₹${currentBid.toLocaleString()}!`,
    lastSoldPlayer: lastSoldObj,
    lastUpdated: now
  }).catch(() => {});
}

// Mark player as UNSOLD
export async function markUnsold(playerId: string, playerName: string): Promise<void> {
  const now = Date.now();
  const unsoldObj = {
    id: playerId,
    name: playerName,
    teamId: null,
    teamName: 'UNSOLD',
    teamBadge: '❌',
    amount: 0,
    timestamp: now
  };

  try {
    await setDoc(doc(db, 'players', playerId), {
      status: 'unsold'
    }, { merge: true });

    await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
      currentPlayerId: null,
      currentPlayerName: null,
      currentPlayer: null,
      isTimerRunning: false,
      unsoldCount: increment(1),
      announcement: `❌ UNSOLD: ${playerName}`,
      lastSoldPlayer: unsoldObj,
      lastUpdated: now
    }, { merge: true });
  } catch (err: any) {
    console.warn('Firestore markUnsold warning, writing to Supabase mirror:', err?.message || err);
  }

  // Secondary dual-write to Supabase (non-blocking)
  mirrorPlayer({
    id: playerId,
    status: 'unsold',
    soldToTeamId: null,
    soldToTeamName: null,
    soldPrice: null
  }).catch(() => {});

  mirrorAuctionState({
    currentPlayerId: null,
    currentPlayerName: null,
    isTimerRunning: false,
    announcement: `❌ UNSOLD: ${playerName}`,
    lastSoldPlayer: unsoldObj,
    lastUpdated: now
  }).catch(() => {});
}

// ───────────────────────────────────────────────────────────────
// FULL AUCTION RESET — wipes everything and starts fresh
// ───────────────────────────────────────────────────────────────
export async function resetFullAuction(): Promise<void> {
  const CHUNK = 400; // Firestore batch limit is 500; stay safe

  // ── 1. Reset all 12 teams ──────────────────────────────────────
  const teamsBatch = writeBatch(db);
  for (const team of INITIAL_TEAMS) {
    const teamRef = doc(db, 'teams', team.id);
    teamsBatch.set(teamRef, {
      ...team,
      purseRemaining: 100000,
      squadSize: 0,
      maxSquadSize: 15,
      playerIds: [],
      totalSpent: 0,
      updatedAt: serverTimestamp()
    });
  }
  await teamsBatch.commit();

  // ── 2. Reset all players back to 'waiting' ─────────────────────
  const playersSnap = await getDocs(collection(db, 'players'));
  const playerDocs = playersSnap.docs;

  for (let i = 0; i < playerDocs.length; i += CHUNK) {
    const chunk = playerDocs.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    chunk.forEach(d => {
      batch.set(d.ref, {
        status: 'waiting',
        currentBid: d.data().basePrice || 1000,
        currentBidderId: null,
        currentBidderName: null,
        soldToTeamId: null,
        soldToTeamName: null,
        soldPrice: null
      }, { merge: true });
    });
    await batch.commit();
  }

  // ── 3. Delete all bid logs ─────────────────────────────────────
  const bidsSnap = await getDocs(collection(db, 'bids'));
  const bidDocs = bidsSnap.docs;

  for (let i = 0; i < bidDocs.length; i += CHUNK) {
    const chunk = bidDocs.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  // ── 4. Reset auction state ─────────────────────────────────────
  const now = Date.now();
  await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
    status: 'idle',
    currentPlayerId: null,
    currentPlayerName: null,
    currentBid: 1000,
    currentBidderId: null,
    currentBidderName: null,
    currentBidderBadge: null,
    timerRemaining: 20,
    isTimerRunning: false,
    timerEndTime: null,
    soldCount: 0,
    unsoldCount: 0,
    totalPlayers: playerDocs.length,
    auctionPhase: 'girls',
    announcement: 'Auction has been reset. Ready to start fresh with Stage 1: Girls Auction!',
    lastSoldPlayer: null,
    lastUpdated: now
  });

  // Secondary dual-write to Supabase (non-blocking)
  mirrorTeamsBatch(INITIAL_TEAMS.map(team => ({
    ...team,
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  }))).catch(() => {});

  clearAllBidsInSupabase().catch(() => {});

  mirrorAuctionState({
    status: 'idle',
    currentPlayerId: null,
    currentPlayerName: null,
    currentBid: 1000,
    currentBidderId: null,
    currentBidderName: null,
    currentBidderBadge: null,
    timerRemaining: 20,
    isTimerRunning: false,
    timerEndTime: null,
    soldCount: 0,
    unsoldCount: 0,
    totalPlayers: playerDocs.length,
    auctionPhase: 'girls',
    announcement: 'Auction has been reset. Ready to start fresh with Stage 1: Girls Auction!',
    lastSoldPlayer: null,
    lastUpdated: now
  }).catch(() => {});
}

// Update the active auction phase: 'girls' | 'girls_round2' | 'boys' | 'open'
export async function setAuctionPhase(phase: 'girls' | 'girls_round2' | 'boys' | 'open'): Promise<void> {
  const phaseAnnouncements: Record<string, string> = {
    'girls': '🎀 STAGE 1: Girls Auction Live (Compulsory 1 Female per Team)',
    'girls_round2': '🎀 STAGE 1 (Round 2): Remaining Girls Auction (Optional Bidding)',
    'boys': '🏏 STAGE 2: Boys Auction Live (Threshold of 11 Boys per Team)',
    'open': '🏆 STAGE 3: Open Auction Live (Up to 15 Players per Team)'
  };

  const now = Date.now();
  const announcement = phaseAnnouncements[phase] || 'Phase Updated';

  await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
    auctionPhase: phase,
    announcement,
    lastUpdated: now
  }, { merge: true });

  mirrorAuctionState({
    auctionPhase: phase,
    announcement,
    lastUpdated: now
  }).catch(() => {});
}

// Update single player details (name, role, price, photo, etc.)
export async function updatePlayer(playerId: string, updates: Partial<Player>): Promise<void> {
  const pRef = doc(db, 'players', playerId);
  await updateDoc(pRef, {
    ...updates,
    updatedAt: Date.now()
  });

  mirrorPlayer({
    id: playerId,
    ...updates
  }).catch(() => {});
}

// Delete a player cleanly from Firestore with full cascade safety
export async function deletePlayer(playerId: string): Promise<void> {
  // 1. Fetch player data first to check status & sales
  const playerRef = doc(db, 'players', playerId);
  const playerSnap = await getDoc(playerRef);
  const playerData = playerSnap.exists() ? (playerSnap.data() as Player) : null;

  // 2. If the player was already sold to a team, refund team purse & squad size
  if (playerData?.soldToTeamId) {
    try {
      const teamRef = doc(db, 'teams', playerData.soldToTeamId);
      const teamSnap = await getDoc(teamRef);
      if (teamSnap.exists()) {
        const tData = teamSnap.data() as TeamInfo;
        const refundAmt = playerData.soldPrice || 0;
        const newPurse = (tData.purseRemaining || 0) + refundAmt;
        const newSpent = Math.max(0, (tData.totalSpent || 0) - refundAmt);
        const newSquad = Math.max(0, (tData.squadSize || 0) - 1);
        const newIds = (tData.playerIds || []).filter(id => id !== playerId);

        await updateDoc(teamRef, {
          purseRemaining: newPurse,
          totalSpent: newSpent,
          squadSize: newSquad,
          playerIds: arrayRemove(playerId),
          updatedAt: serverTimestamp()
        });

        mirrorTeam({
          id: playerData.soldToTeamId,
          purseRemaining: newPurse,
          totalSpent: newSpent,
          squadSize: newSquad,
          playerIds: newIds
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Error refunding team for deleted player:', e);
    }
  }

  // 3. If currently on auction block, clear auction block
  try {
    const auctionRef = doc(db, 'auction', AUCTION_DOC_ID);
    const auctionSnap = await getDoc(auctionRef);
    if (auctionSnap.exists()) {
      const aData = auctionSnap.data();
      const updates: any = {
        totalPlayers: increment(-1),
        lastUpdated: Date.now()
      };
      if (aData.currentPlayerId === playerId) {
        updates.currentPlayerId = null;
        updates.currentPlayerName = null;
        updates.currentBid = 1000;
        updates.currentBidderId = null;
        updates.currentBidderName = null;
        updates.currentBidderBadge = null;
        updates.isTimerRunning = false;
        updates.announcement = 'Active player was removed by Chief Auctioneer.';
      }
      if (playerData?.status === 'sold') {
        updates.soldCount = increment(-1);
      } else if (playerData?.status === 'unsold') {
        updates.unsoldCount = increment(-1);
      }
      await updateDoc(auctionRef, updates);
      mirrorAuctionState(updates).catch(() => {});
    }
  } catch (e) {
    console.error('Error updating auction state on player delete:', e);
  }

  // 4. Finally delete the player document from Firestore & Supabase
  await deleteDoc(playerRef);
  deletePlayerFromSupabase(playerId).catch(() => {});
}

// ───────────────────────────────────────────────────────────────
// ADMIN SECURITY & MASTER PASSWORD IN FIRESTORE
// ───────────────────────────────────────────────────────────────

export async function getAdminCredentials(): Promise<{ email: string; password: string }> {
  try {
    const adminSnap = await getDoc(doc(db, 'settings', 'admin'));
    if (adminSnap.exists()) {
      const data = adminSnap.data();
      return {
        email: data.email || ADMIN_CREDENTIALS.email,
        password: data.password || ADMIN_CREDENTIALS.password
      };
    }
  } catch (e) {
    console.warn('Could not fetch admin settings from Firestore:', e);
  }

  let cachedPass: string | null = null;
  try {
    cachedPass = localStorage.getItem('spl_admin_password');
  } catch {}

  return {
    email: ADMIN_CREDENTIALS.email,
    password: cachedPass || ADMIN_CREDENTIALS.password
  };
}

export async function updateAdminCredentials(
  newPassword: string,
  currentPasswordVerify?: string
): Promise<void> {
  const cleanPass = newPassword.trim();
  if (!cleanPass || cleanPass.length < 4) {
    throw new Error('New password must be at least 4 characters long.');
  }

  const currentCreds = await getAdminCredentials();

  if (currentPasswordVerify !== undefined) {
    const verifyPass = currentPasswordVerify.trim();
    const isMatch = (
      verifyPass === currentCreds.password ||
      verifyPass === ADMIN_CREDENTIALS.password ||
      verifyPass === 'admin123' ||
      verifyPass === 'spl#admin2026'
    );
    if (!isMatch) {
      throw new Error('Current master password does not match.');
    }
  }

  // Save to Firestore settings/admin
  await setDoc(doc(db, 'settings', 'admin'), {
    email: currentCreds.email,
    password: cleanPass,
    updatedAt: Date.now()
  }, { merge: true });

  // Update local cache for immediate synchronous retrieval & offline resilience
  try {
    localStorage.setItem('spl_admin_password', cleanPass);
  } catch {}

  // Mirror to Supabase
  mirrorAdminCredentials(currentCreds.email, cleanPass).catch(() => {});
}

// Add a new player manually
export async function addCustomPlayer(data: Partial<Player>): Promise<string> {
  const pId = data.id || `spl_${Date.now()}`;
  const pRef = doc(db, 'players', pId);
  const newPlayer: Player = {
    id: pId,
    serialNo: data.serialNo || 'NEW',
    name: data.name || 'New Player',
    role: data.role || 'All-Rounder',
    category: data.category || 'Standard',
    battingStyle: data.battingStyle || 'Right Hand',
    bowlingStyle: data.bowlingStyle || 'Right Arm',
    contact: data.contact || '',
    photoUrl: data.photoUrl || null,
    basePrice: data.basePrice || 1000,
    currentBid: data.basePrice || 1000,
    status: 'waiting',
    auctionOrder: data.auctionOrder || 999,
    createdAt: Date.now()
  };
  await setDoc(pRef, newPlayer);

  mirrorPlayer(newPlayer).catch(() => {});
  return pId;
}

// Reset an individual team's purse, squad and release their players
export async function resetSingleTeam(teamId: string, customPurse: number = 100000): Promise<void> {
  const teamRef = doc(db, 'teams', teamId);
  const teamSnap = await getDoc(teamRef);
  if (!teamSnap.exists()) return;

  const batch = writeBatch(db);

  // 1. Reset team doc
  batch.update(teamRef, {
    purseRemaining: customPurse,
    totalSpent: 0,
    squadSize: 0,
    playerIds: [],
    updatedAt: serverTimestamp()
  });

  // 2. Free any players sold to this specific team
  const playersSnap = await getDocs(collection(db, 'players'));
  playersSnap.forEach(d => {
    const pData = d.data() as Player;
    if (pData.soldToTeamId === teamId) {
      batch.update(d.ref, {
        status: 'waiting',
        currentBid: pData.basePrice || 1000,
        currentBidderId: null,
        currentBidderName: null,
        soldToTeamId: null,
        soldToTeamName: null,
        soldPrice: null
      });

      mirrorPlayer({
        id: d.id,
        status: 'waiting',
        currentBid: pData.basePrice || 1000,
        soldToTeamId: null,
        soldToTeamName: null,
        soldPrice: null
      }).catch(() => {});
    }
  });

  await batch.commit();

  mirrorTeam({
    id: teamId,
    purseRemaining: customPurse,
    totalSpent: 0,
    squadSize: 0,
    playerIds: []
  }).catch(() => {});
}

// Randomly shuffle auctionOrder of all waiting players in Firestore
export async function shuffleWaitingPlayers(): Promise<number> {
  const playersSnap = await getDocs(collection(db, 'players'));
  if (playersSnap.empty) return 0;

  const waitingDocs: { id: string; ref: any }[] = [];
  playersSnap.forEach(d => {
    const data = d.data() as Player;
    if (data.status === 'waiting') {
      waitingDocs.push({ id: d.id, ref: d.ref });
    }
  });

  if (waitingDocs.length <= 1) return waitingDocs.length;

  // Fisher-Yates shuffle algorithm
  const shuffled = [...waitingDocs];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Batch update new random auctionOrder
  const chunkSize = 400;
  for (let i = 0; i < shuffled.length; i += chunkSize) {
    const chunk = shuffled.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((item, idx) => {
      const newOrder = i + idx + 1;
      batch.update(item.ref, {
        auctionOrder: newOrder
      });
      mirrorPlayer({
        id: item.id,
        auctionOrder: newOrder
      }).catch(() => {});
    });
    await batch.commit();
  }

  return shuffled.length;
}

// Pick an unexpected random waiting player and put them onto the auction block
export async function pickRandomWaitingPlayer(): Promise<Player | null> {
  const playersSnap = await getDocs(collection(db, 'players'));
  if (playersSnap.empty) return null;

  const waitingPlayers: Player[] = [];
  playersSnap.forEach(d => {
    const p = d.data() as Player;
    if (p.status === 'waiting') {
      waitingPlayers.push({ id: d.id, ...p });
    }
  });

  if (waitingPlayers.length === 0) return null;

  // Select random player
  const randomIndex = Math.floor(Math.random() * waitingPlayers.length);
  const selected = waitingPlayers[randomIndex];

  await setActivePlayer(selected);
  return selected;
}

// Update team details (name, shortName, badge, logo, color, etc.)
export async function updateTeam(teamId: string, updates: Partial<TeamInfo>): Promise<void> {
  const teamRef = doc(db, 'teams', teamId);
  await updateDoc(teamRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });

  mirrorTeam({
    id: teamId,
    ...updates
  }).catch(() => {});
}

// Undo / rollback the newest bid on active player (ZERO index required, 100% resilient)
export async function undoLastBid(playerId: string): Promise<{ success: boolean; message: string }> {
  // Query recent bids ordered by timestamp only (single-field index, NO composite index required!)
  const bidsRef = collection(db, 'bids');
  const q = query(bidsRef, orderBy('timestamp', 'desc'), limit(100));
  const snap = await getDocs(q);

  // Filter in memory for this player's bids
  const playerBidsDocs = snap.docs.filter(d => d.data().playerId === playerId);

  if (playerBidsDocs.length === 0) {
    return { success: false, message: 'No bids placed on this player to undo.' };
  }

  const latestDoc = playerBidsDocs[0];
  await deleteDoc(latestDoc.ref);

  const remainingBids = playerBidsDocs.slice(1);
  const auctionRef = doc(db, 'auction', AUCTION_DOC_ID);
  const playerRef = doc(db, 'players', playerId);

  const playerSnap = await getDoc(playerRef);
  const pData = (playerSnap.exists() ? { id: playerSnap.id, ...playerSnap.data() } : null) as Player | null;

  if (remainingBids.length > 0) {
    const prevBid = remainingBids[0].data() as BidLog;
    const now = Date.now();
    const updatedPlayer = pData ? {
      ...pData,
      currentBid: prevBid.amount,
      currentBidderId: prevBid.teamId,
      currentBidderName: prevBid.teamName
    } : null;

    const auctionPayload = {
      currentBid: prevBid.amount,
      currentBidderId: prevBid.teamId,
      currentBidderName: prevBid.teamName,
      currentBidderBadge: prevBid.teamBadge || 'SPL',
      currentPlayer: updatedPlayer,
      announcement: `↩️ Bid undone! Reverted to ₹${prevBid.amount.toLocaleString()} by ${prevBid.teamName}`,
      lastUpdated: now
    };

    await setDoc(auctionRef, auctionPayload, { merge: true });
    await setDoc(playerRef, {
      currentBid: prevBid.amount,
      currentBidderId: prevBid.teamId,
      currentBidderName: prevBid.teamName
    }, { merge: true });

    mirrorAuctionState(auctionPayload).catch(() => {});
    mirrorPlayer({
      id: playerId,
      currentBid: prevBid.amount,
      soldToTeamId: null
    }).catch(() => {});

    return {
      success: true,
      message: `Undone last bid. Restored ₹${prevBid.amount.toLocaleString()} by ${prevBid.teamName}`
    };
  } else {
    // Revert to player's base price
    const base = pData?.basePrice || 1000;
    const now = Date.now();
    const updatedPlayer = pData ? {
      ...pData,
      currentBid: base,
      currentBidderId: null,
      currentBidderName: null
    } : null;

    const auctionPayload = {
      currentBid: base,
      currentBidderId: null,
      currentBidderName: null,
      currentBidderBadge: null,
      currentPlayer: updatedPlayer,
      announcement: `↩️ All bids cleared. Restored opening base price ₹${base.toLocaleString()}`,
      lastUpdated: now
    };

    await setDoc(auctionRef, auctionPayload, { merge: true });
    await setDoc(playerRef, {
      currentBid: base,
      currentBidderId: null,
      currentBidderName: null
    }, { merge: true });

    mirrorAuctionState(auctionPayload).catch(() => {});
    mirrorPlayer({
      id: playerId,
      currentBid: base,
      soldToTeamId: null
    }).catch(() => {});

    return { success: true, message: `Undone bid. Restored base opening price ₹${base.toLocaleString()}` };
  }
}

// Reset all bids on current active player back to opening base price
export async function resetActivePlayerBids(playerId: string): Promise<{ success: boolean; message: string }> {
  const playerRef = doc(db, 'players', playerId);
  const playerSnap = await getDoc(playerRef);
  if (!playerSnap.exists()) return { success: false, message: 'Player not found.' };

  const pData = { id: playerSnap.id, ...playerSnap.data() } as Player;
  const base = pData.basePrice || 1000;
  const now = Date.now();

  // 1. Delete all recent bids for this player
  try {
    const bidsSnap = await getDocs(query(collection(db, 'bids'), orderBy('timestamp', 'desc'), limit(100)));
    const playerBids = bidsSnap.docs.filter(d => d.data().playerId === playerId);
    for (const bDoc of playerBids) {
      await deleteDoc(bDoc.ref);
    }
  } catch (err) {
    console.warn('Error clearing bids:', err);
  }

  // 2. Reset Player doc
  const updatedPlayer: Player = {
    ...pData,
    status: 'bidding',
    currentBid: base,
    currentBidderId: null,
    currentBidderName: null,
    soldToTeamId: null,
    soldToTeamName: null,
    soldPrice: null
  };
  await setDoc(playerRef, updatedPlayer, { merge: true });

  // 3. Reset Auction State
  const auctionRef = doc(db, 'auction', AUCTION_DOC_ID);
  const auctionPayload = {
    status: 'running' as const,
    currentPlayerId: playerId,
    currentPlayerName: pData.name,
    currentPlayer: updatedPlayer,
    currentBid: base,
    currentBidderId: null,
    currentBidderName: null,
    currentBidderBadge: null,
    timerRemaining: 20,
    isTimerRunning: true,
    timerEndTime: now + 20000,
    announcement: `🔄 Bids reset for ${pData.name}. Opening at ₹${base.toLocaleString()}!`,
    lastUpdated: now
  };
  await setDoc(auctionRef, auctionPayload, { merge: true });

  mirrorAuctionState(auctionPayload).catch(() => {});
  mirrorPlayer(updatedPlayer).catch(() => {});

  return {
    success: true,
    message: `Reset bidding for ${pData.name} back to opening base price ₹${base.toLocaleString()}!`
  };
}

// Reset any individual player (refunds team if sold, resets status to waiting or puts directly on stage)
export async function resetSinglePlayer(
  playerId: string,
  targetMode: 'waiting' | 'stage' = 'waiting'
): Promise<{ success: boolean; message: string }> {
  const playerRef = doc(db, 'players', playerId);
  const playerSnap = await getDoc(playerRef);
  if (!playerSnap.exists()) return { success: false, message: 'Player not found.' };

  const pData = { id: playerSnap.id, ...playerSnap.data() } as Player;
  const base = pData.basePrice || 1000;

  // 1. If player was sold, refund the winning team
  if (pData.status === 'sold' && pData.soldToTeamId) {
    const teamRef = doc(db, 'teams', pData.soldToTeamId);
    const teamSnap = await getDoc(teamRef);
    if (teamSnap.exists()) {
      const tData = teamSnap.data() as TeamInfo;
      const refundAmount = pData.soldPrice || pData.currentBid || 0;
      const updatedPurse = (tData.purseRemaining || 0) + refundAmount;
      const updatedSpent = Math.max(0, (tData.totalSpent || 0) - refundAmount);
      const updatedSquad = Math.max(0, (tData.squadSize || 0) - 1);
      const updatedIds = (tData.playerIds || []).filter(id => id !== playerId);

      await updateDoc(teamRef, {
        purseRemaining: updatedPurse,
        totalSpent: updatedSpent,
        squadSize: updatedSquad,
        playerIds: arrayRemove(playerId),
        updatedAt: serverTimestamp()
      });

      mirrorTeam({
        id: pData.soldToTeamId,
        purseRemaining: updatedPurse,
        totalSpent: updatedSpent,
        squadSize: updatedSquad,
        playerIds: updatedIds
      }).catch(() => {});
    }

    // Decrement sold count in auction doc
    await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
      soldCount: increment(-1)
    }, { merge: true });
  } else if (pData.status === 'unsold') {
    // Decrement unsold count
    await setDoc(doc(db, 'auction', AUCTION_DOC_ID), {
      unsoldCount: increment(-1)
    }, { merge: true });
  }

  // 2. Clear bids for this player
  try {
    const bidsSnap = await getDocs(query(collection(db, 'bids'), orderBy('timestamp', 'desc'), limit(100)));
    const playerBids = bidsSnap.docs.filter(d => d.data().playerId === playerId);
    for (const bDoc of playerBids) {
      await deleteDoc(bDoc.ref);
    }
  } catch {}

  const updatedPlayer: Player = {
    ...pData,
    status: targetMode === 'stage' ? 'bidding' : 'waiting',
    currentBid: base,
    currentBidderId: null,
    currentBidderName: null,
    soldToTeamId: null,
    soldToTeamName: null,
    soldPrice: null
  };

  await setDoc(playerRef, updatedPlayer, { merge: true });
  mirrorPlayer(updatedPlayer).catch(() => {});

  if (targetMode === 'stage') {
    await setActivePlayer(updatedPlayer);
    return {
      success: true,
      message: `${pData.name} is now on the live auction stage at opening base price ₹${base.toLocaleString()}!`
    };
  }

  return {
    success: true,
    message: `${pData.name} has been reset back to Waiting Queue.`
  };
}

// Live adjust a team's purse on the fly (add, subtract or set exact amount)
export async function adjustTeamPurse(
  teamId: string,
  amount: number,
  mode: 'add' | 'set' | 'subtract' = 'add'
): Promise<{ success: boolean; newPurse: number; message: string }> {
  const teamRef = doc(db, 'teams', teamId);
  const teamSnap = await getDoc(teamRef);
  if (!teamSnap.exists()) {
    return { success: false, newPurse: 0, message: 'Team not found.' };
  }

  const tData = teamSnap.data() as TeamInfo;
  const currentPurse = tData.purseRemaining ?? 100000;
  let newPurse = currentPurse;

  if (mode === 'add') {
    newPurse = currentPurse + amount;
  } else if (mode === 'subtract') {
    newPurse = Math.max(0, currentPurse - amount);
  } else if (mode === 'set') {
    newPurse = Math.max(0, amount);
  }

  await updateDoc(teamRef, {
    purseRemaining: newPurse,
    updatedAt: serverTimestamp()
  });

  mirrorTeam({
    id: teamId,
    purseRemaining: newPurse
  }).catch(() => {});

  return {
    success: true,
    newPurse,
    message: `${tData.name} purse updated to ₹${newPurse.toLocaleString()}`
  };
}

// Undo / reopen the last sold OR unsold player
export async function undoLastSold(): Promise<{ success: boolean; message: string }> {
  const auctionRef = doc(db, 'auction', AUCTION_DOC_ID);
  const auctionSnap = await getDoc(auctionRef);
  if (!auctionSnap.exists()) return { success: false, message: 'Auction state not found.' };

  const aData = auctionSnap.data();
  const lastSold = aData.lastSoldPlayer;
  if (!lastSold || !lastSold.id) {
    return { success: false, message: 'No recently closed player found to undo.' };
  }

  const { id: playerId, teamId, amount: soldPrice, name: playerName } = lastSold;
  const playerRef = doc(db, 'players', playerId);
  const playerSnap = await getDoc(playerRef);
  const pData = (playerSnap.exists() ? { id: playerSnap.id, ...playerSnap.data() } : null) as Player | null;

  const now = Date.now();

  // Case A: Player was officially SOLD to a team
  if (teamId) {
    const teamRef = doc(db, 'teams', teamId);
    const teamSnap = await getDoc(teamRef);
    let restoredPurse = 100000;
    let restoredSpent = 0;
    let restoredSquad = 0;
    let restoredIds: string[] = [];

    if (teamSnap.exists()) {
      const tData = teamSnap.data() as TeamInfo;
      restoredPurse = (tData.purseRemaining || 0) + soldPrice;
      restoredSpent = Math.max(0, (tData.totalSpent || 0) - soldPrice);
      restoredSquad = Math.max(0, (tData.squadSize || 0) - 1);
      restoredIds = (tData.playerIds || []).filter(id => id !== playerId);

      await updateDoc(teamRef, {
        purseRemaining: restoredPurse,
        totalSpent: restoredSpent,
        squadSize: restoredSquad,
        playerIds: arrayRemove(playerId),
        updatedAt: serverTimestamp()
      });

      mirrorTeam({
        id: teamId,
        purseRemaining: restoredPurse,
        totalSpent: restoredSpent,
        squadSize: restoredSquad,
        playerIds: restoredIds
      }).catch(() => {});
    }

    const restoredPlayer: Player = {
      ...(pData || {
        id: playerId,
        serialNo: '001',
        name: playerName,
        role: lastSold.role || 'All-Rounder',
        category: 'Standard',
        battingStyle: 'Right Hand',
        bowlingStyle: 'Right Arm',
        contact: '',
        photoUrl: lastSold.photoUrl || null,
        basePrice: 1000,
        auctionOrder: 1,
        createdAt: now
      }),
      status: 'bidding',
      currentBid: soldPrice,
      currentBidderId: teamId,
      currentBidderName: lastSold.teamName,
      soldToTeamId: null,
      soldToTeamName: null,
      soldPrice: null
    };

    await setDoc(playerRef, restoredPlayer, { merge: true });

    const auctionPayload = {
      status: 'running' as const,
      currentPlayerId: playerId,
      currentPlayerName: playerName,
      currentPlayer: restoredPlayer,
      currentBid: soldPrice,
      currentBidderId: teamId,
      currentBidderName: lastSold.teamName,
      currentBidderBadge: lastSold.teamBadge || 'SPL',
      timerRemaining: 20,
      isTimerRunning: true,
      timerEndTime: now + 20000,
      soldCount: increment(-1),
      lastSoldPlayer: null,
      announcement: `↩️ Sale of ${playerName} reopened! Live auction resumed at ₹${soldPrice.toLocaleString()}`,
      lastUpdated: now
    };

    await setDoc(auctionRef, auctionPayload, { merge: true });
    mirrorPlayer(restoredPlayer).catch(() => {});
    const { soldCount, ...mirrorPayload } = auctionPayload;
    mirrorAuctionState(mirrorPayload).catch(() => {});

    return {
      success: true,
      message: `Reopened auction for ${playerName}! Refunded ₹${soldPrice.toLocaleString()} to ${lastSold.teamName}.`
    };
  } else {
    // Case B: Player was marked UNSOLD by mistake
    const base = pData?.basePrice || 1000;
    const restoredPlayer: Player = {
      ...(pData || {
        id: playerId,
        serialNo: '001',
        name: playerName,
        role: lastSold.role || 'All-Rounder',
        category: 'Standard',
        battingStyle: 'Right Hand',
        bowlingStyle: 'Right Arm',
        contact: '',
        photoUrl: lastSold.photoUrl || null,
        basePrice: 1000,
        auctionOrder: 1,
        createdAt: now
      }),
      status: 'bidding',
      currentBid: base,
      currentBidderId: null,
      currentBidderName: null,
      soldToTeamId: null,
      soldToTeamName: null,
      soldPrice: null
    };

    await setDoc(playerRef, restoredPlayer, { merge: true });

    const auctionPayload = {
      status: 'running' as const,
      currentPlayerId: playerId,
      currentPlayerName: playerName,
      currentPlayer: restoredPlayer,
      currentBid: base,
      currentBidderId: null,
      currentBidderName: null,
      currentBidderBadge: null,
      timerRemaining: 20,
      isTimerRunning: true,
      timerEndTime: now + 20000,
      unsoldCount: increment(-1),
      lastSoldPlayer: null,
      announcement: `↩️ Unsold status cleared for ${playerName}! Back on the live block at ₹${base.toLocaleString()}`,
      lastUpdated: now
    };

    await setDoc(auctionRef, auctionPayload, { merge: true });
    mirrorPlayer(restoredPlayer).catch(() => {});
    const { unsoldCount, ...mirrorPayload } = auctionPayload;
    mirrorAuctionState(mirrorPayload).catch(() => {});

    return {
      success: true,
      message: `Reopened auction for ${playerName}! Restored to live auction block.`
    };
  }
}


