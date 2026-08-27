import Navbar from './Navbar';

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      <div className="px-4 py-8">{children}</div>
    </div>
  );
}

export default AppLayout;