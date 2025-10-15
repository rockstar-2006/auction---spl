import { db } from './firebase';
import { ref, get, set, update, serverTimestamp, push } from 'firebase/database';
import type { AuctionState, Bid } from '../types/auction.types';

export const auctionRef = ref(db, 'auction');
export const configRef  = ref(db, 'config');

export async function startTimer(durationSec: number) {
  const now = Date.now();
  await update(auctionRef, {
      timerStartTime: now,
      timerEndTime: now + durationSec * 1000,
      timerRemaining: durationSec,
      isTimerRunning: true,
      lastUpdated: serverTimestamp(),
  } as unknown as Partial<AuctionState>);
}

export async function pauseTimer() {
  await update(auctionRef, { isTimerRunning: false });
}

export async function placeBid(playerId: string, myTeamId: string, myTeamName: string, newAmount: number) {
  const bidRef = push(ref(db, `bids/${playerId}`));
  const bid: Bid = {
    id: bidRef.key!, teamId: myTeamId, teamName: myTeamName,
    amount: newAmount, timestamp: Date.now(), playerId
  };
  await set(bidRef, bid);
  await update(ref(db, `players/${playerId}`), { currentBid: newAmount, currentBidderId: myTeamId });
}

export async function markSold(opts: {
  playerId: string; currentBid: number; currentBidderId: string;
  playerName: string; teamName: string; nextPlayerId: string|null; nextIndex: number; timerDuration: number;
}) {
  const { playerId, currentBid, currentBidderId, playerName, teamName, nextPlayerId, nextIndex, timerDuration } = opts;
  // atomic-ish flow per spec (single-writer admin is acceptable)
  await update(ref(db, `players/${playerId}`), {
    status: 'sold', soldToTeamId: currentBidderId, soldPrice: currentBid
  });
  const teamRef = ref(db, `teams/${currentBidderId}`);
  const teamSnap = await get(teamRef);
  const td = teamSnap.val();
  await update(teamRef, {
    purseRemaining: td.purseRemaining - currentBid,
    squadSize: td.squadSize + 1,
    playerIds: [...(td.playerIds||[]), playerId],
    totalSpent: (td.totalSpent||0) + currentBid
  });
  await update(auctionRef, {
    currentPlayerIndex: nextIndex,
    currentPlayerId: nextPlayerId,
    timerRemaining: timerDuration,
    isTimerRunning: false,
    soldPlayers: (await get(ref(db,'auction/soldPlayers'))).val() + 1
  });
  const logRef = push(ref(db,'auctionLog'));
  await set(logRef, {
    action: 'player_sold', playerId, teamId: currentBidderId, amount: currentBid,
    details: `${playerName} sold to ${teamName} for ₹${currentBid}`, timestamp: Date.now()
  });
}
