import { useState } from 'react';
import { detectFormation, Formation, PlayerSnapshot } from '../utils/formationDetector';

export interface FormationHistoryEntry {
  frame: number;
  formation: Formation;
}

export const useFormation = () => {
  const [current, setCurrent] = useState<Formation>(Formation.Unknown);
  const [history, setHistory] = useState<FormationHistoryEntry[]>([]);

  const addSnapshot = (frame: number, players: PlayerSnapshot[]) => {
    const { formation } = detectFormation(players);
    setCurrent(formation);
    setHistory((prev) => [...prev, { frame, formation }]);
  };

  return { currentFormation: current, history, addSnapshot };
};
