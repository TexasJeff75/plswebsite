import React, { useState, useEffect } from 'react';
import { History, Download } from 'lucide-react';
import { auditService } from '../../services/auditService';

export default function ActivityLogTab({ facility }) {
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterField, setFilterField] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    loadActivityLog();
  }, [facility?.id, page]);

  async function loadActivityLog() {
    try {
      setLoading(true);
      const [log, count] = await Promise.all([
        auditService.getActivityLog(facility.id, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
        auditService.getActivityLogCount(facility.id),
      ]);
      setActivityLog(log);
      setTotalCount(count);
    } catch (error) {
      console.error('Error loading activity log:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportCSV() {
    try {
      const allLogs = await auditService.getActivityLog(facility.id, 10000, 0);

      const headers = ['Timestamp', 'Action', 'Field', 'Old Value', 'New Value', 'User'];
      const rows = allLogs.map(entry => [
        new Date(entry.timestamp).toLocaleString(),
        entry.action,
        entry.field_name,
        entry.old_value || '',
        entry.new_value || '',
        entry.user || 'Unknown',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-log-${facility.id}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  }

  if (loading) {
    return <div className="text-slate-400">Loading activity log...</div>;
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const filteredLog = filterField
    ? activityLog.filter(entry => entry.field_name?.includes(filterField))
    : activityLog;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <History className="w-5 h-5" />
          Activity Log
        </h3>
        <button
          onClick={handleExportCSV}
          className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm flex items-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filter */}
      <div className="bg-slate-800 rounded-lg p-4">
        <input
          type="text"
          placeholder="Filter by field name..."
          value={filterField}
          onChange={(e) => {
            setFilterField(e.target.value);
            setPage(0);
          }}
          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 placeholder-slate-500"
        />
      </div>

      {/* Activity Log List */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        {filteredLog.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {filterField ? 'No matching entries found' : 'No activity recorded yet'}
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredLog.map(entry => (
              <div key={entry.id} className="p-4 hover:bg-slate-700 transition-colors">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold">
                      <span className="text-teal-300">{entry.action}</span> {entry.field_name}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="bg-slate-700 px-2 py-1 rounded text-xs text-slate-300">
                      {entry.user || 'Unknown User'}
                    </span>
                  </div>
                </div>

                {(entry.old_value || entry.new_value) && (
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-700">
                    {entry.old_value && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Old Value</p>
                        <div className="bg-slate-700 px-3 py-2 rounded text-sm text-slate-300 break-words max-h-20 overflow-y-auto">
                          {entry.old_value}
                        </div>
                      </div>
                    )}
                    {entry.new_value && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">New Value</p>
                        <div className="bg-slate-700 px-3 py-2 rounded text-sm text-teal-300 break-words max-h-20 overflow-y-auto">
                          {entry.new_value}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-white rounded text-sm transition-colors"
          >
            Previous
          </button>
          <span className="text-slate-400 text-sm">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-white rounded text-sm transition-colors"
          >
            Next
          </button>
        </div>
      )}

      <div className="text-center text-slate-400 text-sm">
        Total entries: {totalCount}
      </div>
    </div>
  );
}
