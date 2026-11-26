import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export const LEADERBOARD_COLLECTION = 'leaderboard';
export const PLAYER_NAME_MIN_LENGTH = 1;
export const PLAYER_NAME_MAX_LENGTH = 24;
export const PLAYER_NAME_PATTERN = /^[a-zA-Z0-9äöüÄÖÜß ._-]+$/;
export const SCORE_MAX = 10000000;
export const DISTANCE_MAX = 5000000;
export const CRYSTALS_MAX = 1000000;

export interface LeaderboardEntry {
  userId: string;
  playerName: string;
  score: number;
  distance: number;
  crystals: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export function sanitizePlayerName(rawName: string | null | undefined): string {
  const cleaned = (rawName || '')
    .trim()
    .replace(/[^a-zA-Z0-9äöüÄÖÜß ._-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PLAYER_NAME_MAX_LENGTH);

  if (cleaned.length >= PLAYER_NAME_MIN_LENGTH && PLAYER_NAME_PATTERN.test(cleaned)) {
    return cleaned;
  }
  return 'WinterSurfer';
}

function clampInt(val: number, max: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.min(max, Math.max(0, Math.floor(val)));
}

export function subscribeLeaderboard(
  onData: (entries: LeaderboardEntry[]) => void,
  onError: (err: Error) => void,
  topCount: number = 15
): () => void {
  const q = query(
    collection(db, LEADERBOARD_COLLECTION),
    where('score', '>=', 0),
    orderBy('score', 'desc'),
    limit(topCount)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: LeaderboardEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (typeof data.score === 'number' && typeof data.playerName === 'string') {
          entries.push({
            userId: typeof data.userId === 'string' ? data.userId : docSnap.id,
            playerName: data.playerName,
            score: data.score,
            distance: typeof data.distance === 'number' ? data.distance : 0,
            crystals: typeof data.crystals === 'number' ? data.crystals : 0,
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          });
        }
      });
      onData(entries);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, LEADERBOARD_COLLECTION);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function fetchMyLeaderboardEntry(uid: string): Promise<LeaderboardEntry | null> {
  const path = `${LEADERBOARD_COLLECTION}/${uid}`;
  try {
    const snap = await getDoc(doc(db, LEADERBOARD_COLLECTION, uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      userId: typeof data.userId === 'string' ? data.userId : snap.id,
      playerName: typeof data.playerName === 'string' ? data.playerName : 'WinterSurfer',
      score: typeof data.score === 'number' ? data.score : 0,
      distance: typeof data.distance === 'number' ? data.distance : 0,
      crystals: typeof data.crystals === 'number' ? data.crystals : 0,
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function submitLeaderboardScore(
  user: User,
  score: number,
  distance: number,
  crystals: number,
  preferredName?: string
): Promise<{ saved: boolean; isNewBest: boolean; entry: LeaderboardEntry }> {
  const safeScore = clampInt(score, SCORE_MAX);
  const safeDistance = clampInt(distance, DISTANCE_MAX);
  const safeCrystals = clampInt(crystals, CRYSTALS_MAX);
  const playerName = sanitizePlayerName(preferredName || user.displayName);
  const docRef = doc(db, LEADERBOARD_COLLECTION, user.uid);
  const path = `${LEADERBOARD_COLLECTION}/${user.uid}`;

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!existingSnap.exists()) {
    try {
      await setDoc(docRef, {
        userId: user.uid,
        playerName,
        score: safeScore,
        distance: safeDistance,
        crystals: safeCrystals,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    return {
      saved: true,
      isNewBest: true,
      entry: {
        userId: user.uid,
        playerName,
        score: safeScore,
        distance: safeDistance,
        crystals: safeCrystals,
      },
    };
  }

  const prevData = existingSnap.data();
  const prevScore = typeof prevData.score === 'number' ? prevData.score : 0;
  const prevName = typeof prevData.playerName === 'string' ? prevData.playerName : playerName;

  if (safeScore > prevScore) {
    try {
      await updateDoc(docRef, {
        playerName: preferredName ? playerName : prevName,
        score: safeScore,
        distance: safeDistance,
        crystals: safeCrystals,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return {
      saved: true,
      isNewBest: true,
      entry: {
        userId: user.uid,
        playerName: preferredName ? playerName : prevName,
        score: safeScore,
        distance: safeDistance,
        crystals: safeCrystals,
      },
    };
  }

  return {
    saved: false,
    isNewBest: false,
    entry: {
      userId: user.uid,
      playerName: prevName,
      score: prevScore,
      distance: typeof prevData.distance === 'number' ? prevData.distance : 0,
      crystals: typeof prevData.crystals === 'number' ? prevData.crystals : 0,
    },
  };
}

export async function updateLeaderboardNickname(
  user: User,
  rawName: string
): Promise<string> {
  const playerName = sanitizePlayerName(rawName);
  const docRef = doc(db, LEADERBOARD_COLLECTION, user.uid);
  const path = `${LEADERBOARD_COLLECTION}/${user.uid}`;

  let snap;
  try {
    snap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!snap.exists()) {
    try {
      await setDoc(docRef, {
        userId: user.uid,
        playerName,
        score: 0,
        distance: 0,
        crystals: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    return playerName;
  }

  try {
    await updateDoc(docRef, {
      playerName,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
  return playerName;
}
