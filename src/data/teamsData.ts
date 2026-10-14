export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  email: string;
  password: string;
  color: string;
  accentColor: string;
  badge: string;
  logoUrl?: string;
  purseRemaining: number;
  squadSize: number;
  maxSquadSize: number;
  playerIds: string[];
  totalSpent: number;
}

export const INITIAL_TEAMS: TeamInfo[] = [
  {
    id: "team_thunderbolts",
    name: "Royal Thunderbolts",
    shortName: "RTB",
    email: "thunderbolts@spl.com",
    password: "spl#thunder2026",
    color: "#1d4ed8", // Royal Blue
    accentColor: "#d4af37", // Gold
    badge: "RTB",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_warriors",
    name: "Shadow Warriors",
    shortName: "SHW",
    email: "warriors@spl.com",
    password: "spl#warrior2026",
    color: "#334155", // Slate
    accentColor: "#94a3b8", // Silver
    badge: "SHW",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_titans",
    name: "Blaze Titans",
    shortName: "BLT",
    email: "titans@spl.com",
    password: "spl#titans2026",
    color: "#c2410c", // Deep Orange
    accentColor: "#f59e0b", // Amber
    badge: "BLT",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_breakers",
    name: "Storm Breakers",
    shortName: "STB",
    email: "breakers@spl.com",
    password: "spl#breakers2026",
    color: "#0e7490", // Cyan
    accentColor: "#38bdf8", // Light blue
    badge: "STB",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_vipers",
    name: "Venom Vipers",
    shortName: "VNV",
    email: "vipers@spl.com",
    password: "spl#vipers2026",
    color: "#15803d", // Emerald Green
    accentColor: "#84cc16", // Lime
    badge: "VNV",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_kings",
    name: "Inferno Kings",
    shortName: "IFK",
    email: "kings@spl.com",
    password: "spl#kings2026",
    color: "#b91c1c", // Crimson Red
    accentColor: "#d4af37", // Gold
    badge: "IFK",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_raiders",
    name: "Night Raiders",
    shortName: "NTR",
    email: "raiders@spl.com",
    password: "spl#raiders2026",
    color: "#4338ca", // Indigo
    accentColor: "#a855f7", // Purple
    badge: "NTR",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_panthers",
    name: "Iron Panthers",
    shortName: "IRP",
    email: "panthers@spl.com",
    password: "spl#panthers2026",
    color: "#1e293b", // Dark Slate
    accentColor: "#cbd5e1", // Platinum
    badge: "IRP",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_crushers",
    name: "Crimson Crushers",
    shortName: "CRC",
    email: "crushers@spl.com",
    password: "spl#crushers2026",
    color: "#991b1b", // Deep Crimson
    accentColor: "#f87171", // Coral
    badge: "CRC",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_strikers",
    name: "Phoenix Strikers",
    shortName: "PHS",
    email: "strikers@spl.com",
    password: "spl#strikers2026",
    color: "#a21caf", // Fuchsia
    accentColor: "#f97316", // Warm Orange
    badge: "PHS",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_wolves",
    name: "Desert Wolves",
    shortName: "DSW",
    email: "wolves@spl.com",
    password: "spl#wolves2026",
    color: "#b45309", // Desert Gold
    accentColor: "#fde047", // Sand
    badge: "DSW",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  },
  {
    id: "team_hawks",
    name: "Thunder Hawks",
    shortName: "THH",
    email: "hawks@spl.com",
    password: "spl#hawks2026",
    color: "#0369a1", // Sky Blue
    accentColor: "#c7d2fe", // Ice
    badge: "THH",
    purseRemaining: 100000,
    squadSize: 0,
    maxSquadSize: 15,
    playerIds: [],
    totalSpent: 0
  }
];

export const ADMIN_CREDENTIALS = {
  email: "admin@spl.com",
  password: "spl#admin2026",
  name: "SPL Chief Auctioneer"
};
