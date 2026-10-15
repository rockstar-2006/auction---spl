import { Player } from './player.types';

export type AuctionStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface SoldPlayerSummary {
  id: string;
  name: string;
  role?: string;
  photoUrl?: string | null;
  teamId: string | null;
  teamName: string;
  teamBadge?: string;
  amount: number;
  timestamp: number;
}

export interface AuctionState {
  status: AuctionStatus;
  currentPlayerId: string | null;
  currentPlayerName: string | null;
  currentPlayer?: Player | null;
  currentBid: number;
  currentBidderId: string | null;
  currentBidderName: string | null;
  currentBidderBadge?: string | null;
  timerRemaining: number;
  isTimerRunning: boolean;
  timerEndTime: number | null;
  soldCount: number;
  unsoldCount: number;
  totalPlayers: number;
  announcement?: string | null;
  auctionPhase?: 'girls' | 'girls_round2' | 'boys' | 'open';
  lastSoldPlayer?: SoldPlayerSummary | null;
  lastUpdated: number;
}

export interface BidLog {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  teamBadge?: string;
  amount: number;
  timestamp: number;
}
