import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { FileText, Database } from 'lucide-react';

const SETTINGS_NAV = [
  { path: '/settings/templates', label: 'Templates', icon: FileText },
  { path: '/settings/reference-data', label: 'Reference Data', icon: Database },
];

export default function Settings() {
  const location = useLocation();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-slate-700 pb-4">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <div className="flex gap-2 ml-auto">
          {SETTINGS_NAV.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-500/10 text-teal-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      <Outlet />
    </div>
  );
}
