export type PlayerRole = 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper' | 'Other';
export type PlayerStatus = 'waiting' | 'bidding' | 'sold' | 'unsold';

export interface Player {
  id: string;
  serialNo?: number | string;
  name: string;
  role: string;
  category?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  contact?: string;
  photoUrl?: string | null;
  basePrice: number;
  currentBid: number;
  currentBidderId?: string | null;
  currentBidderName?: string | null;
  status: PlayerStatus;
  soldToTeamId?: string | null;
  soldToTeamName?: string | null;
  soldPrice?: number;
  gender?: 'female' | 'male';
  auctionOrder: number;
  createdAt: number;
}
