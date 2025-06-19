import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Formation, PlayerSnapshot } from '../utils/formationDetector';
import { FormationHistoryEntry } from '../hooks/useFormation';

interface Props {
  history: FormationHistoryEntry[];
}

const COLORS: Record<Formation, string> = {
  [Formation.MotionOffense]: '#16a34a',
  [Formation.PickAndRoll]: '#2563eb',
  [Formation.Isolation]: '#dc2626',
  [Formation.ZoneDefense]: '#ca8a04',
  [Formation.ManToManDefense]: '#7c3aed',
  [Formation.Unknown]: '#64748b',
};

const StatsDashboard: React.FC<Props> = ({ history }) => {
  const formationCounts = useMemo(() => {
    const counts: Record<Formation, number> = {
      [Formation.MotionOffense]: 0,
      [Formation.PickAndRoll]: 0,
      [Formation.Isolation]: 0,
      [Formation.ZoneDefense]: 0,
      [Formation.ManToManDefense]: 0,
      [Formation.Unknown]: 0,
    };
    history.forEach((h) => {
      counts[h.formation] += 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [history]);

  if (history.length === 0) return null;

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-4">戦術統計</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-64">
        {/* Pie Chart for usage frequency */}
        <ResponsiveContainer>
          <PieChart>
            <Pie dataKey="value" data={formationCounts} label>
              {formationCounts.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.name as Formation]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        {/* Bar chart */}
        <ResponsiveContainer>
          <BarChart data={formationCounts}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value">
              {formationCounts.map((entry, index) => (
                <Cell key={`bar-${index}`} fill={COLORS[entry.name as Formation]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsDashboard;
