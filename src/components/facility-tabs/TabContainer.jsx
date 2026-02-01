import React, { useState } from 'react';

export default function TabContainer({ tabs, defaultTab = 0 }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-slate-700 flex-shrink-0">
        <div className="flex flex-col gap-1 p-3">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-3 rounded-lg font-medium text-left transition-colors ${
                activeTab === index
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {tabs[activeTab]?.component}
      </div>
    </div>
  );
}
