import React from 'react';
import VideoUploader from './components/VideoUploader';
import CourtCanvas from './components/CourtCanvas';
import { usePoseData } from './hooks/usePoseData';
import { useFormation } from './hooks/useFormation';
import FormationDisplay from './components/FormationDisplay';
import TabsNav from './components/TabsNav';
import TeamEfficiencyPanel from './components/TeamEfficiencyPanel';
import StatsDashboard from './components/StatsDashboard';

const App: React.FC = () => {
    const { addPoint, clear, downloadJson, data } = usePoseData();
  const { addSnapshot, currentFormation, history } = useFormation();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-800 text-white py-4 px-6 text-xl font-semibold">
        <TabsNav />
        Basketball Tactics Analyzer
      </header>
      <main className="flex-grow p-6 bg-gray-50 space-y-6">
        <VideoUploader onAddPoint={(frame:number,x:number,y:number)=>{
            addPoint({frame,x,y});
            // Temporary snapshot with single player id
            addSnapshot(frame,[{frame,id:'p1',x,y}]);
          }} onClear={clear} />
        <div className="space-y-4">
            <FormationDisplay formation={currentFormation} />
            <CourtCanvas points={data} />
          </div>
        {data.length > 0 && (
          <button
            onClick={downloadJson}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            位置JSONをダウンロード
          </button>
        )}
      {history.length>0 && <StatsDashboard history={history} />}
        <TeamEfficiencyPanel />
      </main>
      <footer className="bg-gray-200 text-gray-700 text-sm py-2 text-center">
        © 2025 Tactics Analyzer
      </footer>
    </div>
  );
};

export default App;
