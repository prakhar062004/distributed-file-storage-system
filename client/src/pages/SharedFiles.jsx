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
        const res = await api.get('/files/shared-with-me', {
          headers: { Authorization: `Bearer ${token}` },
        });
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
      READ: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      WRITE: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded border ${styles[permission] || styles.READ}`}>
        {permission}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Shared with Me</h1>
          <p className="text-slate-400 text-sm">Files other people have given you access to</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          {loading ? (
            <p className="text-slate-400 text-sm p-6 text-center">Loading…</p>
          ) : files.length === 0 ? (
            <p className="text-slate-400 text-sm p-6 text-center">
              Nothing here yet. Files someone shares with you will show up in this list.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-700 text-slate-300 text-left">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Size</th>
                  <th className="px-4 py-2">Access</th>
                  <th className="px-4 py-2">Shared</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file._id} className="border-t border-slate-700 text-slate-200">
                    <td className="px-4 py-2">{file.name}</td>
                    <td className="px-4 py-2">{formatSize(file.size)}</td>
                    <td className="px-4 py-2">{permissionBadge(file.myPermission)}</td>
                    <td className="px-4 py-2 text-slate-400">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </td>
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