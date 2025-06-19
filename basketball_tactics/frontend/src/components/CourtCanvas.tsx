import React from 'react';
import { PosePoint } from '../hooks/usePoseData';

interface CourtCanvasProps {
  points: PosePoint[];
}

// Simple SVG court 94x50 units, orange points for nose landmarks
const CourtCanvas: React.FC<CourtCanvasProps> = ({ points }) => {
  const width = 940; // px
  const height = 500;
  const scaleX = width / 94;
  const scaleY = height / 50;

  return (
    <svg
      viewBox="0 0 94 50"
      width={width}
      height={height}
      className="bg-orange-50 border border-gray-300 rounded"
    >
      {/* court outline */}
      <rect x={0} y={0} width={94} height={50} fill="transparent" stroke="black" strokeWidth={0.2} />
      {/* center circle */}
      <circle cx={47} cy={25} r={6} fill="none" stroke="black" strokeWidth={0.2} />

      {/* points */}
      {points.map((pt: PosePoint) => (
        <circle key={pt.frame} cx={pt.x} cy={pt.y} r={0.8} fill="#ff0000" />
      ))}
    </svg>
  );
};

export default CourtCanvas;
