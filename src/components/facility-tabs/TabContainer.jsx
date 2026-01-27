import React, { useState } from 'react';

export default function TabContainer({ tabs, defaultTab = 0 }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-700 overflow-x-auto">
        <div className="flex gap-2 p-4 min-w-full">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === index
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
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
