import { useState, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { getCultos, createCulto, createSlot, deleteCulto } from '../db/database';
import CultoBuilder from '../components/Builder/CultoBuilder';
import { CULTO_TEMPLATES, SLIDE_TYPE_COLORS } from '../components/Builder/templates';
import { peekBuilderIntent, clearBuilderIntent } from '../utils/navigationIntents';

export default function BuilderPage() {
  const [cultos, setCultos] = useState([]);
  const [selectedId, setSelectedId] = useState(() => {
    const saved = localStorage.getItem('operator_cultoId');
    return saved ? Number(saved) : null;
  });
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingBuilderIntent, setPendingBuilderIntent] = useState(null);

  const handlePendingIntentConsumed = useCallback(() => {
    setPendingBuilderIntent(null);
  }, []);

  useLayoutEffect(() => {
    const intent = peekBuilderIntent();
    if (!intent) return;
    clearBuilderIntent();
    setSelectedId(intent.cultoId);
    setShowNewForm(false);
    setPendingBuilderIntent(intent);
  }, []);

  useEffect(() => {
    setCultos(getCultos());
  }, [refreshKey]);

  function handleCreate(tplId = null) {
    if (!newName.trim()) return;
    const id = createCulto({ name: newName });
    if (tplId) {
      const tpl = CULTO_TEMPLATES.find((t) => t.id === tplId);
      tpl.slides.forEach((slide) => createSlot({ culto_id: id, ...slide }));
    }
    const list = getCultos();
    setCultos(list);
    setSelectedId(id);
    setShowNewForm(false);
    setShowTemplates(false);
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
            onClick={() => { setShowNewForm(true); setShowTemplates(false); setSelectedId(null); }}
          >
            + Nuevo culto
          </button>
        </div>

        {showNewForm && (
          <div className="bg-gray-700 rounded-xl p-4 mb-6 flex flex-col gap-3">
            <div className="flex gap-3">
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
                onClick={() => handleCreate()}
                disabled={!newName.trim()}
              >
                Crear en blanco
              </button>
              <button
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  showTemplates
                    ? 'bg-indigo-800 text-white'
                    : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                }`}
                onClick={() => setShowTemplates((v) => !v)}
              >
                Desde template {showTemplates ? '▲' : '▼'}
              </button>
              <button
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                onClick={() => { setShowNewForm(false); setShowTemplates(false); }}
              >
                Cancelar
              </button>
            </div>

            {showTemplates && (
              <div className="flex flex-col gap-2 pt-1">
                {CULTO_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    className="w-full text-left bg-gray-600 hover:bg-gray-500 border border-gray-500 hover:border-indigo-400 rounded-lg px-4 py-3 transition-colors disabled:opacity-40"
                    onClick={() => handleCreate(tpl.id)}
                    disabled={!newName.trim()}
                  >
                    <p className="text-sm font-semibold text-white mb-1">{tpl.name}</p>
                    <p className="text-xs text-gray-400 mb-2">{tpl.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {tpl.slides.map((s, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-0.5 rounded-full text-white/90 ${SLIDE_TYPE_COLORS[s.type]}`}
                        >
                          {s.label}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
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
            pendingIntent={pendingBuilderIntent}
            onPendingIntentConsumed={handlePendingIntentConsumed}
          />
        )}
      </div>
    </div>
  );
}
