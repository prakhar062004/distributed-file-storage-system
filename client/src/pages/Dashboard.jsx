import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { uploadFile, listFiles, deleteFile, getDownloadUrl } from '../services/fileService';
import AppLayout from '../components/AppLayout';

function Dashboard() {
  const { user, token } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const fetchFiles = async () => {
    try {
      const res = await listFiles(token);
      setFiles(res.data.files);
    } catch (err) {
      setError('Failed to load files');
    }
  };

  useEffect(() => { fetchFiles(); }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await uploadFile(file, token);
      await fetchFiles();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await deleteFile(fileId, token);
      await fetchFiles();
    } catch (err) {
      setError('Failed to delete file');
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">My Files</h1>
          <p className="text-slate-400 text-sm mt-1">{user?.name} · {user?.email}</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-lg mb-5 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <label className="group block mb-6 cursor-pointer">
          <div className="border-2 border-dashed border-white/10 hover:border-violet-400/40 bg-white/[0.02] hover:bg-white/[0.04] rounded-2xl p-8 text-center transition-all duration-200">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            {uploading ? (
              <p className="text-violet-300 text-sm font-medium">Uploading…</p>
            ) : (
              <>
                <p className="text-slate-300 text-sm font-medium group-hover:text-white transition-colors">
                  Click to choose a file, or drop it here
                </p>
                <p className="text-slate-500 text-xs mt-1">Files are chunked and replicated automatically</p>
              </>
            )}
          </div>
        </label>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
          {files.length === 0 ? (
            <p className="text-slate-400 text-sm p-10 text-center">No files uploaded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/5">
                  <th className="px-5 py-3 text-slate-400 font-medium">Name</th>
                  <th className="px-5 py-3 text-slate-400 font-medium">Size</th>
                  <th className="px-5 py-3 text-slate-400 font-medium">Uploaded</th>
                  <th className="px-5 py-3 text-slate-400 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file._id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-slate-100 font-medium">{file.name}</td>
                    <td className="px-5 py-3.5 text-slate-400">{formatSize(file.size)}</td>
                    <td className="px-5 py-3.5 text-slate-400">{new Date(file.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right space-x-4">
                      <a
                        href={getDownloadUrl(file._id)}
                        onClick={(e) => {
                          e.preventDefault();
                          fetch(getDownloadUrl(file._id), { headers: { Authorization: `Bearer ${token}` } })
                            .then((res) => res.blob())
                            .then((blob) => {
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = file.name;
                              a.click();
                              window.URL.revokeObjectURL(url);
                            });
                        }}
                        className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer transition-colors"
                      >
                        Download
                      </a>
                      <button
                        onClick={() => handleDelete(file._id)}
                        className="text-red-400 hover:text-red-300 font-medium transition-colors"
                      >
                        Delete
                      </button>
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

export default Dashboard;