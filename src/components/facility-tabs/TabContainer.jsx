import React, { useState } from 'react';

export default function TabContainer({ tabs, defaultTab = 0 }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-700 bg-slate-800/50">
        <div className="flex gap-1 px-4">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-6 py-3 font-medium text-sm transition-all relative ${
                activeTab === index
                  ? 'text-teal-400 bg-slate-700/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
              }`}
            >
              {tab.label}
              {activeTab === index && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400"></div>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
        {tabs[activeTab]?.component}
      </div>
    </div>
  );
}
