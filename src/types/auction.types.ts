export type AuctionStatus = 'idle'|'running'|'paused'|'completed';

export interface Config {
  bidIncrement: number; maxPlayerPrice: number; minTeamSize: number; maxTeamSize: number;
  totalPurse: number; timerDuration: number; basePrice: number;
}
export interface AuctionState {
  status: AuctionStatus;
  currentPlayerIndex: number;
  currentPlayerId: string | null;
  timerStartTime: number | null;
  timerEndTime: number | null;
  timerRemaining: number;
  isTimerRunning: boolean;
  totalPlayers: number;
  soldPlayers: number;
  createdAt: number;
  lastUpdated: number;
}
export interface Bid {
  id: string;
  teamId: string;
  teamName: string;
  amount: number;
  timestamp: number;
  playerId: string;
}
export interface AuctionLog {
  id: string;
  action: 'player_sold'|'auction_started'|'auction_paused'|'auction_resumed'|'bid_placed';
  playerId?: string|null; teamId?: string|null; amount?: number|null;
  details?: string; timestamp: number;
}
