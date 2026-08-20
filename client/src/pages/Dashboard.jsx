import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { uploadFile, listFiles, deleteFile, getDownloadUrl } from '../services/fileService';

function Dashboard() {
  const { user, token, logout } = useAuth();
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

  useEffect(() => {
    fetchFiles();
  }, []);

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
    <div className="min-h-screen bg-slate-900 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Files</h1>
            <p className="text-slate-400 text-sm">{user?.name} · {user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
          >
            Logout
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="bg-slate-800 p-4 rounded-lg mb-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            disabled={uploading}
            className="text-slate-300 text-sm"
          />
          {uploading && <p className="text-blue-400 text-sm mt-2">Uploading...</p>}
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          {files.length === 0 ? (
            <p className="text-slate-400 text-sm p-6 text-center">No files uploaded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-700 text-slate-300 text-left">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Size</th>
                  <th className="px-4 py-2">Uploaded</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file._id} className="border-t border-slate-700 text-slate-200">
                    <td className="px-4 py-2">{file.name}</td>
                    <td className="px-4 py-2">{formatSize(file.size)}</td>
                    <td className="px-4 py-2">{new Date(file.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-right space-x-3">
                      <a
                        href={getDownloadUrl(file._id)}
                        onClick={(e) => {
                          e.preventDefault();
                          fetch(getDownloadUrl(file._id), {
                            headers: { Authorization: `Bearer ${token}` },
                          })
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
                        className="text-blue-400 hover:underline cursor-pointer"
                      >
                        Download
                      </a>
                      <button
                        onClick={() => handleDelete(file._id)}
                        className="text-red-400 hover:underline"
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
    </div>
  );
}

export default Dashboard;