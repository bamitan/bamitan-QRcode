import React from 'react';
import { Formation } from '../utils/formationDetector';

type Props = {
  formation: Formation;
};

const colorMap: Record<Formation, string> = {
  [Formation.MotionOffense]: 'bg-green-600',
  [Formation.PickAndRoll]: 'bg-blue-600',
  [Formation.Isolation]: 'bg-red-600',
  [Formation.ZoneDefense]: 'bg-yellow-600',
  [Formation.ManToManDefense]: 'bg-purple-600',
  [Formation.Unknown]: 'bg-gray-600',
};

const FormationDisplay: React.FC<Props> = ({ formation }) => (
  <div
    className={`inline-block px-3 py-1 text-white rounded ${colorMap[formation]}`}
  >
    {formation}
  </div>
);

export default FormationDisplay;
