import React, { useState, useEffect } from 'react';
import { History, Download, Filter } from 'lucide-react';
import { auditService } from '../../services/auditService';

export default function ActivityLogTab({ facility }) {
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTable, setFilterTable] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const ITEMS_PER_PAGE = 50;

  // Helper function to format table names for display
  const formatTableName = (tableName) => {
    if (!tableName) return 'Unknown';
    return tableName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function to format field names for display
  const formatFieldName = (fieldName) => {
    if (!fieldName) return '';
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get action badge color
  const getActionColor = (action) => {
    switch(action) {
      case 'created': return 'bg-green-600/20 text-green-300';
      case 'updated': return 'bg-blue-600/20 text-blue-300';
      case 'deleted': return 'bg-red-600/20 text-red-300';
      default: return 'bg-slate-600/20 text-slate-300';
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return then.toLocaleDateString();
  };

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

  // Apply filters
  const filteredLog = activityLog.filter(entry => {
    if (filterTable && entry.table_name !== filterTable) return false;
    if (filterAction && entry.action !== filterAction) return false;
    return true;
  });

  // Get unique table names for filter dropdown
  const uniqueTables = [...new Set(activityLog.map(entry => entry.table_name))].filter(Boolean);

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

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <h4 className="text-sm font-medium text-slate-300">Filters</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Table</label>
            <select
              value={filterTable}
              onChange={(e) => {
                setFilterTable(e.target.value);
                setPage(0);
              }}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 text-sm"
            >
              <option value="">All Tables</option>
              {uniqueTables.map(table => (
                <option key={table} value={table}>
                  {formatTableName(table)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Action</label>
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                setPage(0);
              }}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 text-sm"
            >
              <option value="">All Actions</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
        </div>
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
              <div key={entry.id} className="p-4 hover:bg-slate-750 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Timeline dot */}
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-2 h-2 rounded-full ${
                      entry.action === 'created' ? 'bg-green-400' :
                      entry.action === 'updated' ? 'bg-blue-400' :
                      'bg-red-400'
                    }`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(entry.action)}`}>
                            {entry.action.toUpperCase()}
                          </span>
                          <span className="text-slate-500 text-xs">•</span>
                          <span className="text-slate-300 text-sm font-medium">
                            {formatTableName(entry.table_name)}
                          </span>
                          {entry.field_name && (
                            <>
                              <span className="text-slate-500 text-xs">•</span>
                              <span className="text-slate-400 text-sm">
                                {formatFieldName(entry.field_name)}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="font-medium text-teal-300">{entry.user}</span>
                          <span>•</span>
                          <span title={new Date(entry.timestamp).toLocaleString()}>
                            {formatRelativeTime(entry.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Value changes */}
                    {(entry.old_value || entry.new_value) && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {entry.old_value && (
                            <div>
                              <p className="text-slate-400 text-xs mb-1.5 font-medium">Previous Value</p>
                              <div className="bg-slate-900/50 border border-slate-700/50 px-3 py-2 rounded text-sm text-slate-300 break-words max-h-24 overflow-y-auto">
                                {entry.old_value}
                              </div>
                            </div>
                          )}
                          {entry.new_value && (
                            <div>
                              <p className="text-slate-400 text-xs mb-1.5 font-medium">New Value</p>
                              <div className="bg-teal-500/10 border border-teal-500/30 px-3 py-2 rounded text-sm text-teal-200 break-words max-h-24 overflow-y-auto">
                                {entry.new_value}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
