import React, { useState } from 'react';
import { FileText, Target, Package } from 'lucide-react';
import DeploymentTemplatesTab from './templates/DeploymentTemplatesTab';
import MilestoneTemplatesTab from './templates/MilestoneTemplatesTab';
import EquipmentCatalogTab from './templates/EquipmentCatalogTab';

const TABS = [
  { id: 'deployment', label: 'Deployment Templates', icon: FileText },
  { id: 'milestone', label: 'Milestone Templates', icon: Target },
  { id: 'equipment', label: 'Equipment Catalog', icon: Package },
];

export default function Templates() {
  const [activeTab, setActiveTab] = useState('deployment');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Template Management</h1>
        <p className="text-slate-400 text-sm mt-1">
          Configure deployment templates, milestone workflows, and equipment catalog
        </p>
      </div>

      <div className="border-b border-slate-700">
        <div className="flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-teal-400 text-teal-400'
                    : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {activeTab === 'deployment' && <DeploymentTemplatesTab />}
        {activeTab === 'milestone' && <MilestoneTemplatesTab />}
        {activeTab === 'equipment' && <EquipmentCatalogTab />}
      </div>
    </div>
  );
}
