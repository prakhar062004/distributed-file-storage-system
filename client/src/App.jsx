import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SharedFiles from './pages/SharedFiles';
import NodeStatus from './pages/NodeStatus';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shared"
        element={
          <ProtectedRoute>
            <SharedFiles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nodes"
        element={
          <ProtectedRoute>
            <NodeStatus />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;