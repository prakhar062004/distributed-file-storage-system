import { useEffect, useState } from 'react';
import api from './services/api';

function App() {
  const [status, setStatus] = useState('checking...');

  useEffect(() => {
    api.get('/health')
      .then((res) => setStatus(res.data.message))
      .catch(() => setStatus('Failed to connect to backend'));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Distributed File Storage System</h1>
        <p className="text-lg text-slate-300">Backend status: {status}</p>
      </div>
    </div>
  );
}

export default App;