export const LANE_WIDTH = 2.4;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH] as const;
export type LaneIndex = 0 | 1 | 2; // 0 = Left, 1 = Center, 2 = Right

export const BASE_SPEED = 28; // Initial speed in km/h units
export const MID_SPEED = 50; // Reached smoothly around ~20,000 points
export const MAX_SPEED = 68; // Max speed ceiling so it stays fast yet controllable

export const JUMP_VELOCITY = 13.5;
export const GRAVITY = 32;
export const SLIDE_DURATION = 0.75; // seconds

export enum ObstacleType {
  ADBLOCK_SHIELD = 'ADBLOCK_SHIELD',     // Low obstacle (Jump or dodge)
  COOKIE_BANNER = 'COOKIE_BANNER',       // High barrier (Slide or dodge)
  FIREWALL_404 = 'FIREWALL_404',         // Full height block (Must dodge)
  TRACKING_BARRIER = 'TRACKING_BARRIER', // Low laser hurdle (Jump or dodge)
  ONCOMING_DRONE = 'ONCOMING_DRONE',     // Oncoming hovering firewall drone (Flies towards you!)
}

export enum CollectibleType {
  CRYSTAL = 'CRYSTAL',
  GOLD_CLICK = 'GOLD_CLICK',
  POWERUP_MAGNET = 'POWERUP_MAGNET',
  POWERUP_SHIELD = 'POWERUP_SHIELD',
  POWERUP_BOOST = 'POWERUP_BOOST',
}

export interface ObstacleData {
  id: number;
  type: ObstacleType;
  lane: LaneIndex;
  z: number;
  width: number;
  height: number;
  minY: number; // For collision height checking
  maxY: number;
  meshGroup?: any;
  speed?: number; // Speed at which it moves towards player (in +Z direction)
  animTime?: number;
}

export interface CollectibleData {
  id: number;
  type: CollectibleType;
  lane: LaneIndex;
  z: number;
  y: number;
  meshGroup?: any;
  collected?: boolean;
}

export interface GameStats {
  score: number;
  crystals: number;
  distance: number;
  highScore: number;
  speed: number;
  multiplier: number;
  hasShield: boolean;
  magnetTimer: number;
  boostTimer: number;
  shieldTimer: number;
  reasonForDeath?: string;
}
