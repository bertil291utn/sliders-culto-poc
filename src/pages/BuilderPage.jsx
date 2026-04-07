import { useState, useEffect, useMemo } from 'react';
import { getCultos, createCulto, deleteCulto } from '../db/database';
import CultoBuilder from '../components/Builder/CultoBuilder';

export default function BuilderPage() {
  const [cultos, setCultos] = useState([]);
  const [selectedId, setSelectedId] = useState(() => {
    const saved = localStorage.getItem('operator_cultoId');
    return saved ? Number(saved) : null;
  });
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setCultos(getCultos());
  }, [refreshKey]);

  function handleCreate() {
    if (!newName.trim()) return;
    const id = createCulto({ name: newName });
    const list = getCultos();
    setCultos(list);
    setSelectedId(id);
    setShowNewForm(false);
    setNewName('');
  }

  function handleDelete(id) {
    if (confirm('¿Eliminar este culto y todos sus slots?')) {
      deleteCulto(id);
      if (selectedId === id) setSelectedId(null);
      setRefreshKey((k) => k + 1);
    }
  }
  const selectedCulto = useMemo(
    () => cultos.find((c) => c.id === selectedId) ?? null,
    [cultos, selectedId]
  );

  return (
    <div className="flex gap-6 h-full">
      {/* Historial sidebar — siempre visible */}
      <div className="w-56 flex-shrink-0 bg-gray-800 rounded-xl p-3 flex flex-col gap-1 self-start">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 px-1">Historial</p>
        {cultos.length === 0 && (
          <p className="text-gray-500 text-sm px-1">Sin cultos</p>
        )}
        {cultos.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer group transition-colors ${
              selectedId === c.id
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-700 text-gray-300'
            }`}
            onClick={() => { setSelectedId(c.id); setShowNewForm(false); setNewName(''); }}
          >
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{c.name}</span>
              {c.date && (
                <span className="text-xs opacity-60">{c.date}</span>
              )}
            </div>
            <button
              className="ml-2 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 text-xs flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
              title="Eliminar culto"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Main content — centrado */}
      <div className="flex-1 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Constructor del culto</h1>
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium"
            onClick={() => { setShowNewForm(true); setSelectedId(null); }}
          >
            + Nuevo culto
          </button>
        </div>

        {showNewForm && (
          <div className="bg-gray-700 rounded-xl p-4 mb-6 flex gap-3">
            <input
              className="flex-1 bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              placeholder="Nombre del nuevo culto"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium disabled:opacity-40"
              onClick={handleCreate}
              disabled={!newName.trim()}
            >
              Crear
            </button>
            <button
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
              onClick={() => setShowNewForm(false)}
            >
              Cancelar
            </button>
          </div>
        )}

        {!selectedCulto && !showNewForm && (
          <p className="text-gray-500 text-center py-12">
            Selecciona un culto del historial o crea uno nuevo.
          </p>
        )}

        {selectedCulto && (
          <CultoBuilder
            culto={selectedCulto}
            onChange={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </div>
    </div>
  );
}
