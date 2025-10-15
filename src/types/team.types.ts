export interface Team {
  id: string; teamName: string; ownerName: string; email: string;
  logoUrl?: string|null; colorCode: string;
  purseRemaining: number; squadSize: number; playerIds: string[];
  totalSpent: number; userId?: string; createdAt: number;
}
