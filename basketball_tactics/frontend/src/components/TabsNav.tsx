import { Tab } from '@headlessui/react';
import React from 'react';
import { useFilterStore } from '../hooks/useFilterStore';
import { TabKey } from '../hooks/useFilterStore';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'team', label: 'Team' },
  { key: 'player', label: 'Player' },
  { key: 'opponent', label: 'Opponent' },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const TabsNav: React.FC = () => {
  const { currentTab, setTab } = useFilterStore();
  return (
    <Tab.Group
      selectedIndex={tabs.findIndex((t) => t.key === currentTab)}
      onChange={(idx) => setTab(tabs[idx].key)}
    >
      <Tab.List className="flex space-x-1 bg-blue-900/20 p-1 rounded">
        {tabs.map((t) => (
          <Tab
            key={t.key}
            className={({ selected }) =>
              classNames(
                'w-full py-2.5 text-sm leading-5 font-medium text-blue-700 rounded',
                selected ? 'bg-white shadow' : 'text-blue-100 hover:bg-white/[0.12]'
              )
            }
          >
            {t.label}
          </Tab>
        ))}
      </Tab.List>
    </Tab.Group>
  );
};

export default TabsNav;
