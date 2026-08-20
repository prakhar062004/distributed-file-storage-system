import { useAuth } from '../context/AuthContext';

function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
          >
            Logout
          </button>
        </div>
        <div className="bg-slate-800 p-6 rounded-lg">
          <p className="text-slate-300">Welcome, <span className="text-white font-medium">{user?.name}</span></p>
          <p className="text-slate-400 text-sm mt-1">{user?.email}</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;