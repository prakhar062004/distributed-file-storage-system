import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AppLayout from '../components/AppLayout';

function SharedFiles() {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchShared = async () => {
      try {
        const res = await api.get('/files/shared-with-me', { headers: { Authorization: `Bearer ${token}` } });
        setFiles(res.data.files);
      } catch (err) {
        setError('Failed to load shared files');
      } finally {
        setLoading(false);
      }
    };
    fetchShared();
  }, [token]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const permissionBadge = (permission) => {
    const styles = {
      READ: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      WRITE: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    };
    return (
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${styles[permission] || styles.READ}`}>
        {permission}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Shared with Me</h1>
          <p className="text-slate-400 text-sm mt-1">Files other people have given you access to</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-lg mb-5 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
          {loading ? (
            <p className="text-slate-400 text-sm p-10 text-center">Loading…</p>
          ) : files.length === 0 ? (
            <p className="text-slate-400 text-sm p-10 text-center">
              Nothing here yet. Files someone shares with you will show up in this list.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/5">
                  <th className="px-5 py-3 text-slate-400 font-medium">Name</th>
                  <th className="px-5 py-3 text-slate-400 font-medium">Size</th>
                  <th className="px-5 py-3 text-slate-400 font-medium">Access</th>
                  <th className="px-5 py-3 text-slate-400 font-medium">Shared</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file._id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3.5 text-slate-100 font-medium">{file.name}</td>
                    <td className="px-5 py-3.5 text-slate-400">{formatSize(file.size)}</td>
                    <td className="px-5 py-3.5">{permissionBadge(file.myPermission)}</td>
                    <td className="px-5 py-3.5 text-slate-400">{new Date(file.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default SharedFiles;