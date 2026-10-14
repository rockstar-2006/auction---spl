import { supabase } from './supabase';
import { INITIAL_TEAMS, TeamInfo } from '../data/teamsData';
import { Player } from '../types/player.types';
import { AuctionState, BidLog } from '../types/auction.types';

// Convert DB snake_case team to app TeamInfo
export function formatTeam(row: any): TeamInfo {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    email: row.email,
    password: row.password,
    color: row.color,
    accentColor: row.accent_color,
    badge: row.badge,
    purseRemaining: Number(row.purse_remaining || 0),
    squadSize: Number(row.squad_size || 0),
    maxSquadSize: Number(row.max_squad_size || 15),
    playerIds: row.player_ids || [],
    totalSpent: Number(row.total_spent || 0)
  };
}

// Convert DB snake_case player to app Player
export function formatPlayer(row: any): Player {
  return {
    id: row.id,
    serialNo: row.serial_no,
    name: row.name,
    role: row.role || 'All-Rounder',
    category: row.category || '4th Year',
    battingStyle: row.batting_style || 'Right Hand',
    bowlingStyle: row.bowling_style || 'Right Arm Medium',
    contact: row.contact || '',
    photoUrl: row.photo_url || null,
    basePrice: Number(row.base_price || 1000),
    currentBid: Number(row.current_bid || 1000),
    status: row.status || 'waiting',
    soldToTeamId: row.sold_to_team_id || null,
    soldToTeamName: row.sold_to_team_name || null,
    soldPrice: row.sold_price ? Number(row.sold_price) : null,
    auctionOrder: Number(row.auction_order || 0),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
  };
}

// Convert DB snake_case auction_state to app AuctionState
export function formatAuction(row: any): AuctionState {
  return {
    status: row.status || 'idle',
    currentPlayerId: row.current_player_id || null,
    currentPlayerName: row.current_player_name || null,
    currentBid: Number(row.current_bid || 1000),
    currentBidderId: row.current_bidder_id || null,
    currentBidderName: row.current_bidder_name || null,
    currentBidderBadge: row.current_bidder_badge || null,
    timerRemaining: Number(row.timer_remaining ?? 20),
    isTimerRunning: Boolean(row.is_timer_running),
    timerEndTime: null,
    soldCount: Number(row.sold_count || 0),
    unsoldCount: Number(row.unsold_count || 0),
    totalPlayers: Number(row.total_players || 154),
    announcement: row.announcement || '',
    lastSoldPlayer: row.last_sold_player || null,
    lastUpdated: Number(row.last_updated || Date.now())
  };
}

// Convert DB snake_case bid to app BidLog
export function formatBid(row: any): BidLog {
  return {
    id: String(row.id),
    playerId: row.player_id,
    playerName: row.player_name,
    teamId: row.team_id,
    teamName: row.team_name,
    teamBadge: row.team_badge,
    amount: Number(row.amount),
    timestamp: Number(row.timestamp)
  };
}

// ── 1. INITIALIZE 12 TEAMS IN SUPABASE ─────────────────────
export async function initializeTeamsInSupabase(): Promise<void> {
  const teamRows = INITIAL_TEAMS.map(t => ({
    id: t.id,
    name: t.name,
    short_name: t.shortName,
    email: t.email,
    password: t.password,
    color: t.color,
    accent_color: t.accentColor,
    badge: t.badge,
    purse_remaining: 100000,
    squad_size: 0,
    max_squad_size: 15,
    player_ids: [],
    total_spent: 0
  }));

  const { error: teamErr } = await supabase.from('teams').upsert(teamRows);
  if (teamErr) throw teamErr;

  // Initialize auction state row
  const { error: stateErr } = await supabase.from('auction_state').upsert({
    id: 'current',
    status: 'idle',
    current_player_id: null,
    current_player_name: null,
    current_bid: 1000,
    current_bidder_id: null,
    current_bidder_name: null,
    current_bidder_badge: null,
    timer_remaining: 20,
    is_timer_running: false,
    sold_count: 0,
    unsold_count: 0,
    total_players: 154,
    announcement: 'Welcome to SPL 2026 Auction Arena',
    last_sold_player: null,
    last_updated: Date.now()
  });

  if (stateErr) throw stateErr;
}

// ── 2. IMPORT PLAYERS TO SUPABASE ─────────────────────────
export async function importPlayersToSupabase(players: Player[]): Promise<number> {
  const rows = players.map((p, idx) => ({
    id: p.id || `spl_${String(idx + 1).padStart(3, '0')}`,
    serial_no: String(p.serialNo || idx + 1),
    name: p.name,
    role: p.role || 'All-Rounder',
    category: p.category || '4th Year',
    batting_style: p.battingStyle || 'Right Hand',
    bowling_style: p.bowlingStyle || 'Right Arm Medium',
    contact: p.contact || '',
    photo_url: p.photoUrl || null,
    base_price: Number(p.basePrice || 1000),
    current_bid: Number(p.basePrice || 1000),
    status: p.status || 'waiting',
    auction_order: p.auctionOrder || (idx + 1)
  }));

  const { error } = await supabase.from('players').upsert(rows);
  if (error) throw error;

  await supabase.from('auction_state').update({
    total_players: rows.length,
    last_updated: Date.now()
  }).eq('id', 'current');

  return rows.length;
}

// ── 3. SET ACTIVE PLAYER ON BLOCK ──────────────────────────
export async function setActivePlayer(player: Player): Promise<void> {
  const basePrice = Number(player.basePrice || 1000);

  // Update auction state
  await supabase.from('auction_state').update({
    current_player_id: player.id,
    current_player_name: player.name,
    current_bid: basePrice,
    current_bidder_id: null,
    current_bidder_name: null,
    current_bidder_badge: null,
    timer_remaining: 20,
    is_timer_running: true,
    status: 'running',
    announcement: `Now on Block: ${player.name} (Base: ₹${basePrice.toLocaleString()})`,
    last_updated: Date.now()
  }).eq('id', 'current');

  // Update player status
  await supabase.from('players').update({
    status: 'bidding',
    current_bid: basePrice
  }).eq('id', player.id);
}

// ── 4. PLACE A BID (ATOMIC CHECK) ──────────────────────────
export async function placeBid(
  playerId: string,
  teamId: string,
  teamName: string,
  teamBadge: string,
  amount: number
): Promise<void> {
  // Fetch current auction state
  const { data: stateData, error: stateErr } = await supabase
    .from('auction_state')
    .select('*')
    .eq('id', 'current')
    .single();

  if (stateErr || !stateData) throw new Error('Auction is not active');
  if (stateData.current_player_id !== playerId) throw new Error('Player is no longer on the auction block');
  if (stateData.status !== 'running') throw new Error('Auction is currently paused');

  const currentBid = Number(stateData.current_bid || 0);
  const isFirstBid = !stateData.current_bidder_id;

  if (isFirstBid) {
    if (amount < currentBid) {
      throw new Error(`First bid must be at least opening base price ₹${currentBid.toLocaleString()}`);
    }
  } else {
    if (amount <= currentBid) {
      throw new Error(`Bid must exceed current highest bid of ₹${currentBid.toLocaleString()}`);
    }
  }

  // Fetch team info
  const { data: teamData, error: teamErr } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (teamErr || !teamData) throw new Error('Team not found');

  const purseRemaining = Number(teamData.purse_remaining || 0);
  const squadSize = Number(teamData.squad_size || 0);
  const maxSquadSize = Number(teamData.max_squad_size || 15);

  if (squadSize >= maxSquadSize) {
    throw new Error('Squad full! Maximum 15 players recruited.');
  }

  const slotsNeededAfterThis = maxSquadSize - (squadSize + 1);
  const reservedForRemaining = Math.max(0, slotsNeededAfterThis * 1000);
  const maxAllowedBid = purseRemaining - reservedForRemaining;

  if (amount > maxAllowedBid) {
    throw new Error(
      `Bid ₹${amount.toLocaleString()} exceeds your safe limit! You need to reserve ₹${reservedForRemaining.toLocaleString()} for ${slotsNeededAfterThis} remaining squad slots.`
    );
  }

  // Record bid in bids table
  await supabase.from('bids').insert({
    player_id: playerId,
    player_name: stateData.current_player_name || 'Player',
    team_id: teamId,
    team_name: teamName,
    team_badge: teamBadge,
    amount: amount,
    timestamp: Date.now()
  });

  // Update auction state
  await supabase.from('auction_state').update({
    current_bid: amount,
    current_bidder_id: teamId,
    current_bidder_name: teamName,
    current_bidder_badge: teamBadge,
    timer_remaining: 20,
    is_timer_running: true,
    announcement: `Bid of ₹${amount.toLocaleString()} by ${teamName}!`,
    last_updated: Date.now()
  }).eq('id', 'current');

  // Update player current_bid
  await supabase.from('players').update({
    current_bid: amount
  }).eq('id', playerId);
}

// ── 5. CONFIRM AND MARK PLAYER SOLD ─────────────────────────
export async function markSold(
  playerId: string,
  playerName: string,
  teamId: string,
  teamName: string,
  teamBadge: string,
  amount: number
): Promise<void> {
  // Update team purse and squad
  const { data: teamData } = await supabase
    .from('teams')
    .select('purse_remaining, total_spent, squad_size, player_ids')
    .eq('id', teamId)
    .single();

  if (teamData) {
    const currentPurse = Number(teamData.purse_remaining || 0);
    const currentSpent = Number(teamData.total_spent || 0);
    const currentSquad = Number(teamData.squad_size || 0);
    const playerIds = teamData.player_ids || [];

    await supabase.from('teams').update({
      purse_remaining: Math.max(0, currentPurse - amount),
      total_spent: currentSpent + amount,
      squad_size: currentSquad + 1,
      player_ids: [...playerIds, playerId],
      updated_at: new Date().toISOString()
    }).eq('id', teamId);
  }

  // Update player record
  await supabase.from('players').update({
    status: 'sold',
    sold_to_team_id: teamId,
    sold_to_team_name: teamName,
    sold_price: amount
  }).eq('id', playerId);

  // Update auction state
  const { data: stateData } = await supabase
    .from('auction_state')
    .select('sold_count')
    .eq('id', 'current')
    .single();

  const newSoldCount = Number(stateData?.sold_count || 0) + 1;

  await supabase.from('auction_state').update({
    current_player_id: null,
    current_player_name: null,
    current_bid: 1000,
    current_bidder_id: null,
    current_bidder_name: null,
    current_bidder_badge: null,
    status: 'idle',
    is_timer_running: false,
    sold_count: newSoldCount,
    last_sold_player: {
      id: playerId,
      name: playerName,
      teamId,
      teamName,
      teamBadge,
      amount
    },
    announcement: `SOLD! ${playerName} goes to ${teamName} for ₹${amount.toLocaleString()}!`,
    last_updated: Date.now()
  }).eq('id', 'current');
}

// ── 6. MARK PLAYER UNSOLD ──────────────────────────────────
export async function markUnsold(playerId: string, playerName: string): Promise<void> {
  await supabase.from('players').update({
    status: 'unsold',
    sold_to_team_id: null,
    sold_to_team_name: null,
    sold_price: null
  }).eq('id', playerId);

  const { data: stateData } = await supabase
    .from('auction_state')
    .select('unsold_count')
    .eq('id', 'current')
    .single();

  const newUnsoldCount = Number(stateData?.unsold_count || 0) + 1;

  await supabase.from('auction_state').update({
    current_player_id: null,
    current_player_name: null,
    current_bid: 1000,
    current_bidder_id: null,
    current_bidder_name: null,
    current_bidder_badge: null,
    status: 'idle',
    is_timer_running: false,
    unsold_count: newUnsoldCount,
    last_sold_player: {
      id: playerId,
      name: playerName,
      teamId: null,
      teamName: null,
      teamBadge: null,
      amount: 0
    },
    announcement: `${playerName} went UNSOLD (Round 2 candidate)`,
    last_updated: Date.now()
  }).eq('id', 'current');
}

// ── 7. RESET ENTIRE AUCTION (RESTART) ───────────────────────
export async function resetFullAuction(): Promise<void> {
  // Reset all 12 teams
  await supabase.from('teams').update({
    purse_remaining: 100000,
    total_spent: 0,
    squad_size: 0,
    player_ids: [],
    updated_at: new Date().toISOString()
  }).neq('id', '');

  // Reset all players
  await supabase.from('players').update({
    status: 'waiting',
    sold_to_team_id: null,
    sold_to_team_name: null,
    sold_price: null
  }).neq('id', '');

  // Delete all bid logs
  await supabase.from('bids').delete().neq('id', 0);

  // Reset auction state
  await supabase.from('auction_state').update({
    status: 'idle',
    current_player_id: null,
    current_player_name: null,
    current_bid: 1000,
    current_bidder_id: null,
    current_bidder_name: null,
    current_bidder_badge: null,
    timer_remaining: 20,
    is_timer_running: false,
    sold_count: 0,
    unsold_count: 0,
    announcement: 'Auction has been reset. Ready to start fresh!',
    last_sold_player: null,
    last_updated: Date.now()
  }).eq('id', 'current');
}

// ── 8. RESET SINGLE TEAM PURSE & SQUAD ─────────────────────
export async function resetSingleTeam(teamId: string, customPurse: number = 100000): Promise<void> {
  await supabase.from('teams').update({
    purse_remaining: customPurse,
    total_spent: 0,
    squad_size: 0,
    player_ids: [],
    updated_at: new Date().toISOString()
  }).eq('id', teamId);

  // Free players sold to this team
  await supabase.from('players').update({
    status: 'waiting',
    sold_to_team_id: null,
    sold_to_team_name: null,
    sold_price: null
  }).eq('sold_to_team_id', teamId);
}

// ── 9. UPDATE PLAYER ───────────────────────────────────────
export async function updatePlayer(playerId: string, updates: Partial<Player>): Promise<void> {
  const rowUpdates: any = {};
  if (updates.name !== undefined) rowUpdates.name = updates.name;
  if (updates.serialNo !== undefined) rowUpdates.serial_no = updates.serialNo;
  if (updates.role !== undefined) rowUpdates.role = updates.role;
  if (updates.category !== undefined) rowUpdates.category = updates.category;
  if (updates.battingStyle !== undefined) rowUpdates.batting_style = updates.battingStyle;
  if (updates.bowlingStyle !== undefined) rowUpdates.bowling_style = updates.bowlingStyle;
  if (updates.basePrice !== undefined) rowUpdates.base_price = updates.basePrice;
  if (updates.photoUrl !== undefined) rowUpdates.photo_url = updates.photoUrl;

  const { error } = await supabase.from('players').update(rowUpdates).eq('id', playerId);
  if (error) throw error;
}

// ── 10. DELETE PLAYER ──────────────────────────────────────
export async function deletePlayer(playerId: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', playerId);
  if (error) throw error;
}

// ── 11. ADD CUSTOM PLAYER ──────────────────────────────────
export async function addCustomPlayer(data: Partial<Player>): Promise<string> {
  const pId = data.id || `spl_${Date.now()}`;
  const row = {
    id: pId,
    serial_no: String(data.serialNo || 'NEW'),
    name: data.name || 'New Player',
    role: data.role || 'All-Rounder',
    category: data.category || '4th Year',
    batting_style: data.battingStyle || 'Right Hand',
    bowling_style: data.bowlingStyle || 'Right Arm Medium',
    contact: data.contact || '',
    photo_url: data.photoUrl || null,
    base_price: Number(data.basePrice || 1000),
    current_bid: Number(data.basePrice || 1000),
    status: 'waiting',
    auction_order: data.auctionOrder || 999
  };

  const { error } = await supabase.from('players').insert(row);
  if (error) throw error;
  return pId;
}

// ── 12. TIMER & ANNOUNCEMENTS ─────────────────────────────
export async function startTimer(): Promise<void> {
  await supabase.from('auction_state').update({
    is_timer_running: true,
    last_updated: Date.now()
  }).eq('id', 'current');
}

export async function pauseTimer(): Promise<void> {
  await supabase.from('auction_state').update({
    is_timer_running: false,
    status: 'paused',
    last_updated: Date.now()
  }).eq('id', 'current');
}

export async function updateAnnouncement(msg: string): Promise<void> {
  await supabase.from('auction_state').update({
    announcement: msg,
    last_updated: Date.now()
  }).eq('id', 'current');
}
