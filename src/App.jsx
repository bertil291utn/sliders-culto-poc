import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useDB } from './hooks/useDB';
import LibraryPage from './pages/LibraryPage';
import BuilderPage from './pages/BuilderPage';
import OperatorPage from './pages/OperatorPage';
import ProjectionPage from './pages/ProjectionPage';

function Nav() {
  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-600 text-white'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <nav className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex gap-2 items-center">
      <span className="text-white font-bold mr-4">Culto (Beta 0.1)</span>
      <NavLink to="/library" className={linkClass}>Librería</NavLink>
      <NavLink to="/builder" className={linkClass}>Constructor</NavLink>
      <NavLink to="/operator" className={linkClass}>Operador</NavLink>
    </nav>
  );
}

export default function App() {
  const dbReady = useDB();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/projection" element={<ProjectionPage />} />
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-800 text-white flex flex-col">
              <Nav />
              <main className="flex-1 p-6">
                {!dbReady ? (
                  <div className="flex items-center justify-center h-64 text-gray-400">
                    Cargando base de datos...
                  </div>
                ) : (
                  <Routes>
                    <Route path="/" element={<Navigate to="/library" replace />} />
                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/builder" element={<BuilderPage />} />
                    <Route path="/operator" element={<OperatorPage />} />
                  </Routes>
                )}
              </main>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
