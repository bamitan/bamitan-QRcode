// Utilities for detecting basketball formations based on player positions.
// NOTE: This is an intentionally simplified heuristic implementation meant as a
// starting point. You should tweak thresholds and logic to fit your data and
// add more sophisticated pattern-recognition / ML models as you iterate.

/* eslint-disable @typescript-eslint/no-magic-numbers */

export enum Formation {
  Unknown = 'Unknown',
  MotionOffense = 'Motion Offense',
  PickAndRoll = 'Pick & Roll',
  Isolation = 'Isolation',
  ZoneDefense = 'Zone Defense',
  ManToManDefense = 'Man-to-Man Defense',
}

export interface PlayerSnapshot {
  frame: number;
  id: string; // unique tracking id for player (pose id or custom)
  x: number; // court coordinate in feet (0-94)
  y: number; // court coordinate in feet (0-50)
  team?: 'offense' | 'defense';
}

interface DetectionResult {
  formation: Formation;
  confidence: number; // 0-1
}

/** Euclidean distance squared (faster) */
const dist2 = (a: PlayerSnapshot, b: PlayerSnapshot) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const within = (d2: number, threshold: number) => d2 < threshold * threshold;

/**
 * Very naive pick-and-roll detector: looks for exactly two offensive players
 * whose distance is < 5ft and the rest are spaced > 8ft from them.
 */
function detectPickAndRoll(players: PlayerSnapshot[]): boolean {
  if (players.length < 2) return false;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const close = within(dist2(players[i], players[j]), 5);
      if (!close) continue;
      // Count others farther than 8ft from both
      const spaced = players.every((p, idx) => {
        if (idx === i || idx === j) return true;
        return !within(dist2(p, players[i]), 8) && !within(dist2(p, players[j]), 8);
      });
      if (spaced) return true;
    }
  }
  return false;
}

/** Isolation: one offensive player farther than 12ft from nearest teammate. */
function detectIsolation(players: PlayerSnapshot[]): boolean {
  if (players.length < 2) return false;
  const threshold = 12;
  return players.some((p, idx) => {
    const nearest = players.reduce((min, q, jdx) => {
      if (idx === jdx) return min;
      const d = Math.sqrt(dist2(p, q));
      return d < min ? d : min;
    }, Infinity);
    return nearest > threshold;
  });
}

// Motion Offense detector placeholder – if players continually move & spacing approx equal.
function detectMotion(players: PlayerSnapshot[]): boolean {
  // Without velocity history we assume default unknown will be motion.
  return false;
}

export function detectFormation(players: PlayerSnapshot[]): DetectionResult {
  // Order of checks matters – specific patterns first.
  if (detectPickAndRoll(players)) {
    return { formation: Formation.PickAndRoll, confidence: 0.7 };
  }
  if (detectIsolation(players)) {
    return { formation: Formation.Isolation, confidence: 0.6 };
  }
  if (detectMotion(players)) {
    return { formation: Formation.MotionOffense, confidence: 0.4 };
  }
  return { formation: Formation.Unknown, confidence: 0.1 };
}
