import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  DollarSign, Users, FileText, Calendar, Settings,
  Building2, Lock, TrendingUp
} from 'lucide-react';
import SalesRepsTab from './commissions/SalesRepsTab';
import InvoicesTab from './commissions/InvoicesTab';
import ReportsTab from './commissions/ReportsTab';
import PeriodsTab from './commissions/PeriodsTab';
import RulesTab from './commissions/RulesTab';
import BillComTab from './commissions/BillComTab';
import CommissionSettingsTab from './commissions/CommissionSettingsTab';

const TABS = [
  { id: 'reports', label: 'Reports', icon: FileText, desc: 'Generate & approve commission reports' },
  { id: 'invoices', label: 'Invoices', icon: DollarSign, desc: 'QBO invoices pulled via N8N' },
  { id: 'reps', label: 'Sales Reps', icon: Users, desc: 'Manage sales representatives' },
  { id: 'periods', label: 'Periods', icon: Calendar, desc: 'Commission billing periods' },
  { id: 'rules', label: 'Rules', icon: Settings, desc: 'Commission rate rules' },
  { id: 'billcom', label: 'Bill.com', icon: Building2, desc: 'Create & track payables' },
  { id: 'settings', label: 'Settings', icon: Settings, desc: 'Commission email & configuration settings' },
];

export default function Commissions() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('reports');

  const isAllowed = ['Proximity Admin', 'Super Admin', 'Proximity Staff'].includes(profile?.role);

  if (!isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-white font-semibold text-xl mb-2">Access Restricted</h2>
          <p className="text-slate-400 text-sm">Commission data is confidential and restricted to Proximity staff.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Commissions</h1>
            <p className="text-slate-400 text-sm">Internal · Confidential</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-amber-400 text-xs font-medium">Internal Use Only</span>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'invoices' && <InvoicesTab />}
        {activeTab === 'reps' && <SalesRepsTab />}
        {activeTab === 'periods' && <PeriodsTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'billcom' && <BillComTab />}
        {activeTab === 'settings' && <CommissionSettingsTab />}
      </div>
    </div>
  );
}
