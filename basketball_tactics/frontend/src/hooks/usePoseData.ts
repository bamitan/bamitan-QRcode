import { useState } from 'react';

export interface PosePoint {
  frame: number;
  // For simplicity store only nose landmark; extend later
  x: number; // court feet 0-94
  y: number; // 0-50
}

export const usePoseData = () => {
    const [data, setData] = useState<PosePoint[]>([]);

  const addPoint = (pt: PosePoint) => {
        setData((prev: PosePoint[]) => [...prev, pt]);
  };

  const clear = () => {
    setData([]);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pose_data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return { addPoint, clear, downloadJson, data };
};
