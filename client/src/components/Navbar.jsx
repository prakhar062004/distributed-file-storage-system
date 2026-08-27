import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded text-sm font-medium transition-colors ${
      isActive ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
    }`;

  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="text-white font-semibold mr-4">DFS</span>
          <NavLink to="/dashboard" className={linkClass} end>My Files</NavLink>
          <NavLink to="/shared" className={linkClass}>Shared with Me</NavLink>
          <NavLink to="/nodes" className={linkClass}>Node Status</NavLink>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm hidden sm:inline">{user?.name}</span>
          <button
            onClick={logout}
            className="bg-red-600/90 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;