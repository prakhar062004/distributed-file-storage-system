import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AppLayout from '../components/AppLayout';

function NodeStatus() {
  const { token } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/nodes/status', { headers: { Authorization: `Bearer ${token}` } });
      setNodes(res.data.nodes);
      setLastRefresh(new Date());
      setError('');
    } catch (err) {
      setError('Failed to load node status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const healthyCount = nodes.filter((n) => n.status === 'healthy').length;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-white">Storage Node Status</h1>
            <p className="text-slate-400 text-sm mt-1">
              {loading ? 'Checking cluster…' : `${healthyCount} of ${nodes.length} nodes healthy`}
            </p>
          </div>
          {lastRefresh && (
            <p className="text-xs text-slate-500">
              Updated {lastRefresh.toLocaleTimeString()} · refreshes every 5s
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-lg mb-5 text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {nodes.map((node) => {
            const isHealthy = node.status === 'healthy';
            return (
              <div
                key={node.nodeId}
                className={`rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 ${
                  isHealthy
                    ? 'bg-white/[0.03] border-white/10 hover:border-emerald-400/30 hover:shadow-lg hover:shadow-emerald-500/5'
                    : 'bg-red-500/[0.04] border-red-500/20'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="relative flex h-2.5 w-2.5">
                    {isHealthy && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </span>
                  <span className="text-white font-semibold">{node.nodeId}</span>
                </div>

                <div className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-4 ${
                  isHealthy ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
                }`}>
                  {isHealthy ? 'Healthy' : 'Unreachable'}
                </div>

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Files stored</dt>
                    <dd className="text-slate-100 font-medium">{node.fileCount ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Disk used</dt>
                    <dd className="text-slate-100 font-medium">{formatSize(node.totalSize)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Last seen</dt>
                    <dd className="text-slate-100 font-medium">
                      {node.elapsed != null ? `${Math.round(node.elapsed / 1000)}s ago` : 'never'}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>

        {!loading && nodes.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-10">No storage nodes registered yet.</p>
        )}
      </div>
    </AppLayout>
  );
}

export default NodeStatus;