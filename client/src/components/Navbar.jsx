import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }) =>
    `relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <nav className="sticky top-0 z-20 backdrop-blur-xl bg-slate-950/60 border-b border-white/5">
      <div className="max-w-5xl mx-auto flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-1">
          <span className="mr-5 font-bold text-lg bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            DFS
          </span>
          <NavLink to="/dashboard" className={linkClass} end>My Files</NavLink>
          <NavLink to="/shared" className={linkClass}>Shared with Me</NavLink>
          <NavLink to="/nodes" className={linkClass}>Node Status</NavLink>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm hidden sm:inline">{user?.name}</span>
          <button
            onClick={logout}
            className="text-sm font-medium px-4 py-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110 hover:shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all duration-200"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;