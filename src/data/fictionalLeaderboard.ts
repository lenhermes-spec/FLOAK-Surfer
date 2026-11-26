export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  distance: number;
  crystals: number;
  isPlayer?: boolean;
}

export const FICTIONAL_LEADERBOARD_ENTRIES: LeaderboardEntry[] = [
  {
    id: 'npc-1',
    playerName: 'FrostBlitz_99',
    score: 34820,
    distance: 1840,
    crystals: 94,
  },
  {
    id: 'npc-2',
    playerName: 'PolarEinhorn',
    score: 29450,
    distance: 1590,
    crystals: 81,
  },
  {
    id: 'npc-3',
    playerName: 'SchneeFuchs',
    score: 24180,
    distance: 1320,
    crystals: 68,
  },
  {
    id: 'npc-4',
    playerName: 'EisKomet_HD',
    score: 19640,
    distance: 1095,
    crystals: 57,
  },
  {
    id: 'npc-5',
    playerName: 'GlitzerHuf',
    score: 15890,
    distance: 910,
    crystals: 46,
  },
  {
    id: 'npc-6',
    playerName: 'NordlichtMia',
    score: 12350,
    distance: 735,
    crystals: 38,
  },
  {
    id: 'npc-7',
    playerName: 'PowderKing',
    score: 9420,
    distance: 580,
    crystals: 29,
  },
  {
    id: 'npc-8',
    playerName: 'GletscherMax',
    score: 6780,
    distance: 430,
    crystals: 21,
  },
  {
    id: 'npc-9',
    playerName: 'SnowSurfer_Leo',
    score: 4510,
    distance: 305,
    crystals: 14,
  },
  {
    id: 'npc-10',
    playerName: 'FrostyLena',
    score: 2490,
    distance: 185,
    crystals: 9,
  },
];

export function buildRankedLeaderboard(
  playerName: string,
  playerScore: number,
  playerDistance: number,
  playerCrystals: number
): LeaderboardEntry[] {
  const cleanName = playerName.trim() || 'Du (Floak-Reiter)';
  const list: LeaderboardEntry[] = [...FICTIONAL_LEADERBOARD_ENTRIES];

  if (playerScore > 0) {
    list.push({
      id: 'player-self',
      playerName: cleanName,
      score: Math.round(playerScore),
      distance: Math.round(playerDistance),
      crystals: Math.round(playerCrystals),
      isPlayer: true,
    });
  }

  return list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.isPlayer ? -1 : 1;
  });
}
