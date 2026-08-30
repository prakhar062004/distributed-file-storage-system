import Navbar from './Navbar';

function AppLayout({ children }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="px-4 py-10 animate-fade-in">{children}</div>
    </div>
  );
}

export default AppLayout;