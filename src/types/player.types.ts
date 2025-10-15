export type Role = 'Batsman'|'Bowler'|'All-Rounder'|'Wicket-Keeper'|'Support Staff';
export type PlayerStatus = 'waiting'|'bidding'|'sold'|'passed';

export interface Player {
  id: string; name: string; role: Role; basePrice: number;
  contact: string; photoUrl?: string|null; status: PlayerStatus;
  currentBid: number; currentBidderId?: string|null;
  soldToTeamId?: string|null; soldPrice?: number;
  auctionOrder: number; createdAt: number;
}
