import { supabase } from './supabase';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { AuctionState, BidLog } from '../types/auction.types';
import { Player } from '../types/player.types';
import { TeamInfo, INITIAL_TEAMS } from '../data/teamsData';

const AUCTION_DOC_ID = 'current';

// -----------------------------------------------------------------------------
// STATUS MONITORING & FAILOVER STATE
// -----------------------------------------------------------------------------
export type DbStatus = {
  activeSource: 'firebase' | 'supabase';
  firebaseHealthy: boolean;
  supabaseHealthy: boolean;
  lastMirroredAt: number | null;
  lastError: string | null;
};

const statusState: DbStatus = {
  activeSource: 'firebase',
  firebaseHealthy: true,
  supabaseHealthy: true,
  lastMirroredAt: null,
  lastError: null
};

type StatusListener = (status: DbStatus) => void;
const statusListeners: Set<StatusListener> = new Set();

export function subscribeDbStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener({ ...statusState });
  return () => {
    statusListeners.delete(listener);
  };
}

function updateStatus(updates: Partial<DbStatus>) {
  Object.assign(statusState, updates);
  statusListeners.forEach(listener => listener({ ...statusState }));
}

export function forceDatabaseSource(source: 'firebase' | 'supabase') {
  updateStatus({ activeSource: source });
}

export function getDatabaseStatus(): DbStatus {
  return { ...statusState };
}

// -----------------------------------------------------------------------------
// NON-BLOCKING DUAL-WRITE MIRROR FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Mirror Auction State to Supabase
 */
export async function mirrorAuctionState(state: Partial<AuctionState>): Promise<void> {
  try {
    const payload: any = {
      id: AUCTION_DOC_ID,
      last_updated: state.lastUpdated || Date.now(),
      data: state
    };

    if (state.status !== undefined) payload.status = state.status;
    if (state.currentPlayerId !== undefined) payload.current_player_id = state.currentPlayerId;
    if (state.currentPlayerName !== undefined) payload.current_player_name = state.currentPlayerName;
    if (state.currentBid !== undefined) payload.current_bid = state.currentBid;
    if (state.currentBidderId !== undefined) payload.current_bidder_id = state.currentBidderId;
    if (state.currentBidderName !== undefined) payload.current_bidder_name = state.currentBidderName;
    if (state.currentBidderBadge !== undefined) payload.current_bidder_badge = state.currentBidderBadge;
    if (state.timerRemaining !== undefined) payload.timer_remaining = state.timerRemaining;
    if (state.isTimerRunning !== undefined) payload.is_timer_running = Boolean(state.isTimerRunning);
    if (state.timerEndTime !== undefined) payload.timer_end_time = state.timerEndTime;
    if (state.soldCount !== undefined) payload.sold_count = state.soldCount;
    if (state.unsoldCount !== undefined) payload.unsold_count = state.unsoldCount;
    if (state.totalPlayers !== undefined) payload.total_players = state.totalPlayers;
    if (state.auctionPhase !== undefined) payload.auction_phase = state.auctionPhase;
    if (state.announcement !== undefined) payload.announcement = state.announcement;
    if (state.lastSoldPlayer !== undefined) payload.last_sold_player = state.lastSoldPlayer;

    const { error } = await supabase.from('auction').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase mirror auction warning:', error.message);
      updateStatus({ supabaseHealthy: false, lastError: error.message });
    } else {
      updateStatus({ supabaseHealthy: true, lastMirroredAt: Date.now() });
    }
  } catch (err: any) {
    console.warn('Supabase mirror auction exception:', err?.message || err);
  }
}

/**
 * Mirror a single Team to Supabase
 */
export async function mirrorTeam(team: Partial<TeamInfo> & { id: string }): Promise<void> {
  try {
    const payload: any = {
      id: team.id,
      updated_at: new Date().toISOString(),
      data: team
    };

    if (team.name !== undefined) payload.name = team.name;
    if (team.shortName !== undefined) payload.short_name = team.shortName;
    if (team.email !== undefined) payload.email = team.email;
    if (team.password !== undefined) payload.password = team.password;
    if (team.color !== undefined) payload.color = team.color;
    if (team.accentColor !== undefined) payload.accent_color = team.accentColor;
    if (team.badge !== undefined) payload.badge = team.badge;
    if (team.logoUrl !== undefined) payload.logo_url = team.logoUrl;
    if (team.purseRemaining !== undefined) payload.purse_remaining = team.purseRemaining;
    if (team.squadSize !== undefined) payload.squad_size = team.squadSize;
    if (team.maxSquadSize !== undefined) payload.max_squad_size = team.maxSquadSize;
    if (team.playerIds !== undefined) payload.player_ids = team.playerIds;
    if (team.totalSpent !== undefined) payload.total_spent = team.totalSpent;

    const { error } = await supabase.from('teams').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase mirror team warning:', error.message);
      updateStatus({ supabaseHealthy: false, lastError: error.message });
    } else {
      updateStatus({ supabaseHealthy: true, lastMirroredAt: Date.now() });
    }
  } catch (err: any) {
    console.warn('Supabase mirror team exception:', err?.message || err);
  }
}

/**
 * Mirror multiple Teams in batch to Supabase
 */
export async function mirrorTeamsBatch(teams: TeamInfo[]): Promise<void> {
  try {
    const rows = teams.map(t => ({
      id: t.id,
      name: t.name,
      short_name: t.shortName,
      email: t.email,
      password: t.password,
      color: t.color,
      accent_color: t.accentColor,
      badge: t.badge,
      logo_url: t.logoUrl || null,
      purse_remaining: t.purseRemaining ?? 100000,
      squad_size: t.squadSize ?? 0,
      max_squad_size: t.maxSquadSize ?? 15,
      player_ids: t.playerIds || [],
      total_spent: t.totalSpent ?? 0,
      updated_at: new Date().toISOString(),
      data: t
    }));

    const { error } = await supabase.from('teams').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase mirror teams batch warning:', error.message);
      updateStatus({ supabaseHealthy: false, lastError: error.message });
    } else {
      updateStatus({ supabaseHealthy: true, lastMirroredAt: Date.now() });
    }
  } catch (err: any) {
    console.warn('Supabase mirror teams batch exception:', err?.message || err);
  }
}

/**
 * Mirror a single Player to Supabase
 */
export async function mirrorPlayer(player: Partial<Player> & { id: string }): Promise<void> {
  try {
    const payload: any = {
      id: player.id,
      updated_at: new Date().toISOString(),
      data: player
    };

    if (player.serialNo !== undefined) payload.serial_no = player.serialNo;
    if (player.name !== undefined) payload.name = player.name;
    if (player.role !== undefined) payload.role = player.role;
    if (player.category !== undefined) payload.category = player.category;
    if (player.battingStyle !== undefined) payload.batting_style = player.battingStyle;
    if (player.bowlingStyle !== undefined) payload.bowling_style = player.bowlingStyle;
    if (player.contact !== undefined) payload.contact = player.contact;
    if (player.photoUrl !== undefined) payload.photo_url = player.photoUrl;
    if (player.basePrice !== undefined) payload.base_price = player.basePrice;
    if (player.currentBid !== undefined) payload.current_bid = player.currentBid;
    if (player.status !== undefined) payload.status = player.status;
    if (player.auctionOrder !== undefined) payload.auction_order = player.auctionOrder;
    if (player.soldToTeamId !== undefined) payload.sold_to_team_id = player.soldToTeamId;
    if (player.soldToTeamName !== undefined) payload.sold_to_team_name = player.soldToTeamName;
    if (player.soldPrice !== undefined) payload.sold_price = player.soldPrice;
    if (player.gender !== undefined) payload.gender = player.gender;

    const { error } = await supabase.from('players').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase mirror player warning:', error.message);
      updateStatus({ supabaseHealthy: false, lastError: error.message });
    } else {
      updateStatus({ supabaseHealthy: true, lastMirroredAt: Date.now() });
    }
  } catch (err: any) {
    console.warn('Supabase mirror player exception:', err?.message || err);
  }
}

/**
 * Mirror players in batch to Supabase
 */
export async function mirrorPlayersBatch(players: Player[]): Promise<void> {
  try {
    const chunkSize = 100;
    for (let i = 0; i < players.length; i += chunkSize) {
      const chunk = players.slice(i, i + chunkSize);
      const rows = chunk.map(p => ({
        id: p.id,
        serial_no: p.serialNo || '',
        name: p.name,
        role: p.role || 'All-Rounder',
        category: p.category || 'Standard',
        batting_style: p.battingStyle || 'Right Hand',
        bowling_style: p.bowlingStyle || 'Right Arm',
        contact: p.contact || '',
        photo_url: p.photoUrl || null,
        base_price: p.basePrice || 1000,
        current_bid: p.currentBid || 1000,
        status: p.status || 'waiting',
        auction_order: p.auctionOrder || 999,
        sold_to_team_id: p.soldToTeamId || null,
        sold_to_team_name: p.soldToTeamName || null,
        sold_price: p.soldPrice || null,
        gender: p.gender || null,
        updated_at: new Date().toISOString(),
        data: p
      }));

      const { error } = await supabase.from('players').upsert(rows, { onConflict: 'id' });
      if (error) {
        console.warn('Supabase mirror players batch chunk error:', error.message);
      }
    }
    updateStatus({ supabaseHealthy: true, lastMirroredAt: Date.now() });
  } catch (err: any) {
    console.warn('Supabase mirror players batch exception:', err?.message || err);
  }
}

/**
 * Mirror a single Bid log to Supabase
 */
export async function mirrorBid(bid: {
  id?: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamBadge: string;
  amount: number;
  timestamp: number;
}): Promise<void> {
  try {
    const id = bid.id || `bid_${bid.playerId}_${bid.timestamp}_${Math.random().toString(36).slice(2, 6)}`;
    const payload = {
      id,
      player_id: bid.playerId,
      player_name: bid.playerName,
      team_id: bid.teamId,
      team_name: bid.teamName,
      team_badge: bid.teamBadge,
      amount: bid.amount,
      timestamp: bid.timestamp,
      data: bid
    };
    await supabase.from('bids').upsert(payload, { onConflict: 'id' });
  } catch (err) {
    console.warn('Supabase mirror bid exception:', err);
  }
}

/**
 * Mirror Admin Settings to Supabase
 */
export async function mirrorAdminCredentials(email: string, password: string): Promise<void> {
  try {
    await supabase.from('settings').upsert({
      id: 'admin',
      email,
      password,
      updated_at: new Date().toISOString(),
      data: { email, password }
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Supabase mirror admin credentials error:', err);
  }
}

/**
 * Delete a Player from Supabase
 */
export async function deletePlayerFromSupabase(playerId: string): Promise<void> {
  try {
    await supabase.from('players').delete().eq('id', playerId);
  } catch (err) {
    console.warn('Supabase delete player error:', err);
  }
}

/**
 * Clear all bids on full reset in Supabase
 */
export async function clearAllBidsInSupabase(): Promise<void> {
  try {
    await supabase.from('bids').delete().neq('id', 'placeholder_keep_none');
  } catch (err) {
    console.warn('Supabase clear bids error:', err);
  }
}

// -----------------------------------------------------------------------------
// FULL DATABASE ONE-CLICK SYNC (Firestore -> Supabase)
// -----------------------------------------------------------------------------
export async function syncAllToSupabase(): Promise<{
  success: boolean;
  teamsCount: number;
  playersCount: number;
  message: string;
}> {
  try {
    // 1. Sync Teams
    const teamsSnap = await getDocs(collection(db, 'teams'));
    const teamsList: TeamInfo[] = [];
    teamsSnap.forEach(d => teamsList.push(d.data() as TeamInfo));
    if (teamsList.length > 0) {
      await mirrorTeamsBatch(teamsList);
    }

    // 2. Sync Players
    const playersSnap = await getDocs(collection(db, 'players'));
    const playersList: Player[] = [];
    playersSnap.forEach(d => playersList.push({ id: d.id, ...d.data() } as Player));
    if (playersList.length > 0) {
      await mirrorPlayersBatch(playersList);
    }

    // 3. Sync Auction doc
    const auctionSnap = await getDoc(doc(db, 'auction', AUCTION_DOC_ID));
    if (auctionSnap.exists()) {
      await mirrorAuctionState(auctionSnap.data() as AuctionState);
    }

    // 4. Sync Admin Settings
    const settingsSnap = await getDoc(doc(db, 'settings', 'admin'));
    if (settingsSnap.exists()) {
      const sData = settingsSnap.data();
      await mirrorAdminCredentials(sData.email || 'admin@spl.com', sData.password || 'admin123');
    }

    updateStatus({
      supabaseHealthy: true,
      lastMirroredAt: Date.now(),
      lastError: null
    });

    return {
      success: true,
      teamsCount: teamsList.length,
      playersCount: playersList.length,
      message: `Successfully mirrored ${playersList.length} players and ${teamsList.length} teams to Supabase!`
    };
  } catch (err: any) {
    console.error('Error in syncAllToSupabase:', err);
    updateStatus({
      supabaseHealthy: false,
      lastError: err?.message || 'Sync failed'
    });
    return {
      success: false,
      teamsCount: 0,
      playersCount: 0,
      message: err?.message || 'Sync failed'
    };
  }
}

// -----------------------------------------------------------------------------
// UNIFIED RESILIENT LISTENERS WITH INSTANT FAILOVER (Circuit Breaker)
// -----------------------------------------------------------------------------

/**
 * Map Supabase snake_case row to AuctionState
 */
function mapSupabaseAuctionRow(row: any): AuctionState {
  if (row?.data && row.data.status) {
    return row.data as AuctionState;
  }
  return {
    status: row.status || 'idle',
    currentPlayerId: row.current_player_id || null,
    currentPlayerName: row.current_player_name || null,
    currentBid: Number(row.current_bid) || 1000,
    currentBidderId: row.current_bidder_id || null,
    currentBidderName: row.current_bidder_name || null,
    currentBidderBadge: row.current_bidder_badge || null,
    timerRemaining: row.timer_remaining ?? 20,
    isTimerRunning: Boolean(row.is_timer_running),
    timerEndTime: row.timer_end_time || null,
    soldCount: row.sold_count ?? 0,
    unsoldCount: row.unsold_count ?? 0,
    totalPlayers: row.total_players ?? 0,
    auctionPhase: row.auction_phase || 'girls',
    announcement: row.announcement || '',
    lastSoldPlayer: row.last_sold_player || null,
    lastUpdated: Number(row.last_updated) || Date.now()
  };
}

/**
 * Map Supabase snake_case row to TeamInfo
 */
function mapSupabaseTeamRow(row: any): TeamInfo {
  if (row?.data && row.data.name) {
    return row.data as TeamInfo;
  }
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name || '',
    email: row.email || '',
    password: row.password || '',
    color: row.color || '#540816',
    accentColor: row.accent_color || '#ffd700',
    badge: row.badge || 'SPL',
    logoUrl: row.logo_url || undefined,
    purseRemaining: Number(row.purse_remaining) || 100000,
    squadSize: row.squad_size ?? 0,
    maxSquadSize: row.max_squad_size ?? 15,
    playerIds: row.player_ids || [],
    totalSpent: Number(row.total_spent) || 0
  };
}

/**
 * Map Supabase snake_case row to Player
 */
function mapSupabasePlayerRow(row: any): Player {
  if (row?.data && row.data.name) {
    return { id: row.id, ...row.data } as Player;
  }
  return {
    id: row.id,
    serialNo: row.serial_no || '',
    name: row.name,
    role: row.role || 'All-Rounder',
    category: row.category || 'Standard',
    battingStyle: row.batting_style || 'Right Hand',
    bowlingStyle: row.bowling_style || 'Right Arm',
    contact: row.contact || '',
    photoUrl: row.photo_url || null,
    basePrice: Number(row.base_price) || 1000,
    currentBid: Number(row.current_bid) || 1000,
    status: row.status || 'waiting',
    auctionOrder: row.auction_order || 999,
    soldToTeamId: row.sold_to_team_id || null,
    soldToTeamName: row.sold_to_team_name || null,
    soldPrice: row.sold_price ? Number(row.sold_price) : null,
    gender: row.gender || null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
  };
}

/**
 * Unified Auction State Listener with Automatic Failover
 */
export function listenToAuctionState(onUpdate: (state: AuctionState) => void): () => void {
  let isUnmounted = false;
  let supabaseChannel: any = null;
  let pollingInterval: any = null;

  const fallbackToSupabase = async () => {
    if (isUnmounted) return;
    updateStatus({ activeSource: 'supabase', firebaseHealthy: false });
    console.warn('⚡ [Failover] Active database switched to Supabase for Auction State');

    // 1. Initial snapshot from Supabase
    try {
      const { data, error } = await supabase.from('auction').select('*').eq('id', AUCTION_DOC_ID).single();
      if (!error && data) {
        onUpdate(mapSupabaseAuctionRow(data));
      }
    } catch (e) {
      console.error('Supabase initial auction fetch error:', e);
    }

    // 2. Realtime channel
    try {
      supabaseChannel = supabase
        .channel('auction_state_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'auction', filter: `id=eq.${AUCTION_DOC_ID}` },
          payload => {
            if (payload.new) {
              onUpdate(mapSupabaseAuctionRow(payload.new));
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.error('Supabase realtime channel error:', e);
    }

    // 3. Periodic fallback poll every 2.5s (safety net)
    pollingInterval = setInterval(async () => {
      if (isUnmounted) return;
      try {
        const { data } = await supabase.from('auction').select('*').eq('id', AUCTION_DOC_ID).single();
        if (data) onUpdate(mapSupabaseAuctionRow(data));
      } catch {}
    }, 2500);
  };

  // If already in Supabase mode, start directly
  if (statusState.activeSource === 'supabase') {
    fallbackToSupabase();
    return () => {
      isUnmounted = true;
      if (supabaseChannel) supabase.removeChannel(supabaseChannel);
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }

  // Primary: Firestore
  const unsubFirebase = onSnapshot(
    doc(db, 'auction', AUCTION_DOC_ID),
    snap => {
      if (snap.exists()) {
        updateStatus({ firebaseHealthy: true });
        onUpdate(snap.data() as AuctionState);
      }
    },
    error => {
      console.error('Firestore auction error, triggering failover:', error);
      fallbackToSupabase();
    }
  );

  return () => {
    isUnmounted = true;
    unsubFirebase();
    if (supabaseChannel) supabase.removeChannel(supabaseChannel);
    if (pollingInterval) clearInterval(pollingInterval);
  };
}

/**
 * Unified Teams Listener with Automatic Failover
 */
export function listenToTeams(onUpdate: (teams: TeamInfo[]) => void): () => void {
  let isUnmounted = false;
  let supabaseChannel: any = null;
  let pollingInterval: any = null;

  const fallbackToSupabase = async () => {
    if (isUnmounted) return;
    updateStatus({ activeSource: 'supabase', firebaseHealthy: false });
    console.warn('⚡ [Failover] Active database switched to Supabase for Teams');

    const fetchTeams = async () => {
      try {
        const { data, error } = await supabase.from('teams').select('*');
        if (!error && data && data.length > 0) {
          onUpdate(data.map(mapSupabaseTeamRow));
        }
      } catch (e) {
        console.error('Supabase teams fetch error:', e);
      }
    };

    await fetchTeams();

    try {
      supabaseChannel = supabase
        .channel('teams_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
          fetchTeams();
        })
        .subscribe();
    } catch {}

    pollingInterval = setInterval(fetchTeams, 3500);
  };

  if (statusState.activeSource === 'supabase') {
    fallbackToSupabase();
    return () => {
      isUnmounted = true;
      if (supabaseChannel) supabase.removeChannel(supabaseChannel);
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }

  const unsubFirebase = onSnapshot(
    collection(db, 'teams'),
    snap => {
      if (!snap.empty) {
        updateStatus({ firebaseHealthy: true });
        const list: TeamInfo[] = [];
        snap.forEach(d => list.push(d.data() as TeamInfo));
        onUpdate(list);
      }
    },
    error => {
      console.error('Firestore teams error, triggering failover:', error);
      fallbackToSupabase();
    }
  );

  return () => {
    isUnmounted = true;
    unsubFirebase();
    if (supabaseChannel) supabase.removeChannel(supabaseChannel);
    if (pollingInterval) clearInterval(pollingInterval);
  };
}

/**
 * Unified Players Listener with Automatic Failover
 */
export function listenToPlayers(onUpdate: (players: Player[]) => void): () => void {
  let isUnmounted = false;
  let supabaseChannel: any = null;
  let pollingInterval: any = null;

  const fallbackToSupabase = async () => {
    if (isUnmounted) return;
    updateStatus({ activeSource: 'supabase', firebaseHealthy: false });
    console.warn('⚡ [Failover] Active database switched to Supabase for Players');

    const fetchPlayers = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .order('auction_order', { ascending: true });
        if (!error && data) {
          onUpdate(data.map(mapSupabasePlayerRow));
        }
      } catch (e) {
        console.error('Supabase players fetch error:', e);
      }
    };

    await fetchPlayers();

    try {
      supabaseChannel = supabase
        .channel('players_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
          fetchPlayers();
        })
        .subscribe();
    } catch {}

    pollingInterval = setInterval(fetchPlayers, 4000);
  };

  if (statusState.activeSource === 'supabase') {
    fallbackToSupabase();
    return () => {
      isUnmounted = true;
      if (supabaseChannel) supabase.removeChannel(supabaseChannel);
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }

  const unsubFirebase = onSnapshot(
    collection(db, 'players'),
    snap => {
      updateStatus({ firebaseHealthy: true });
      const list: Player[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Player));
      list.sort((a, b) => (a.auctionOrder || 0) - (b.auctionOrder || 0));
      onUpdate(list);
    },
    error => {
      console.error('Firestore players error, triggering failover:', error);
      fallbackToSupabase();
    }
  );

  return () => {
    isUnmounted = true;
    unsubFirebase();
    if (supabaseChannel) supabase.removeChannel(supabaseChannel);
    if (pollingInterval) clearInterval(pollingInterval);
  };
}
