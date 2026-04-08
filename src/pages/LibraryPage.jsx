import { useState, useEffect } from 'react';
import SongList from '../components/Library/SongList';
import SongEditor from '../components/Library/SongEditor';
import { getSongs } from '../db/database';
import {
  searchHimnario,
  fetchHimnarioDetail,
  normalizeTitle,
  isValidSearchTerm,
} from '../utils/himnarioScraper';

export default function LibraryPage() {
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [editingId, setEditingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // inputValue: what's typed; search: committed valid term (Enter or lupa)
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [searchHint, setSearchHint] = useState('');

  // Web search state
  const [webResults, setWebResults] = useState([]);
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError] = useState(null);

  // Import state
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);

  // Local titles set for duplicate detection
  const [localTitles, setLocalTitles] = useState(new Set());

  // Pre-populated data for web imports
  const [initialData, setInitialData] = useState(null);

  // Sync local titles whenever the library changes
  useEffect(() => {
    const songs = getSongs('');
    setLocalTitles(new Set(songs.map((s) => normalizeTitle(s.title))));
  }, [refreshKey]);

  // Web search — fires only when committed `search` changes (no debounce needed)
  useEffect(() => {
    setWebResults([]);
    setWebError(null);
    if (!search) {
      setWebLoading(false);
      return;
    }
    setWebLoading(true);
    let cancelled = false;
    searchHimnario(search.trim())
      .then((results) => { if (!cancelled) setWebResults(results); })
      .catch(() => { if (!cancelled) setWebError('No se pudo conectar al himnario externo.'); })
      .finally(() => { if (!cancelled) setWebLoading(false); });
    return () => { cancelled = true; };
  }, [search]);

  function commitSearch() {
    const term = inputValue.trim();
    if (term === '') {
      // Clear everything
      setSearch('');
      setSearchHint('');
      return;
    }
    if (!isValidSearchTerm(term)) {
      setSearchHint('Ingresa una palabra real (mín. 4 letras con vocales). Ej: amor, dios, gracia.');
      return;
    }
    setSearchHint('');
    setSearch(term);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') commitSearch();
  }

  function handleNew() {
    setEditingId(null);
    setInitialData(null);
    setView('editor');
  }

  function handleEdit(id) {
    setEditingId(id);
    setInitialData(null);
    setView('editor');
  }

  function handleSaved() {
    setRefreshKey((k) => k + 1);
    setInitialData(null);
    setView('list');
  }

  async function handleAgregar(result) {
    setImportLoading(true);
    setImportError(null);
    try {
      const detail = await fetchHimnarioDetail(result.url);
      setInitialData(detail);
      setEditingId(null);
      setView('editor');
    } catch {
      setImportError(`No se pudo importar "${result.title}". Intenta de nuevo.`);
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {view === 'list'
            ? 'Librería de canciones'
            : editingId
            ? 'Editar canción'
            : initialData
            ? 'Importar canción'
            : 'Nueva canción'}
        </h1>
        {view === 'list' && (
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium"
            onClick={handleNew}
          >
            + Agregar canción
          </button>
        )}
      </div>

      {view === 'list' ? (
        <>
          {/* Search input with inline magnifying glass */}
          <div className="relative mb-4">
            <input
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-10 text-white focus:outline-none focus:border-indigo-500"
              placeholder="Buscar por título o artista..."
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setSearchHint(''); }}
              onKeyDown={handleKeyDown}
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
              onClick={commitSearch}
              tabIndex={-1}
              aria-label="Buscar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </button>
          </div>
          {searchHint && (
            <p className="text-yellow-400 text-xs mt-1 mb-3">{searchHint}</p>
          )}

          {/* Local DB results */}
          <SongList onEdit={handleEdit} refreshKey={refreshKey} search={search} />

          {/* Web results — only shown when a valid search has been committed */}
          {search.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-300 mb-3 flex items-center gap-2">
                Online
                {webLoading && (
                  <span className="text-xs text-gray-500 font-normal">
                    Buscando...
                  </span>
                )}
              </h2>

              {webError && (
                <p className="text-red-400 text-sm mb-2">{webError}</p>
              )}
              {importError && (
                <p className="text-red-400 text-sm mb-2">{importError}</p>
              )}

              {!webLoading && !webError && webResults.length === 0 && (
                <p className="text-gray-500 text-sm">
                  Sin resultados en el himnario.
                </p>
              )}

              <div className="flex flex-col gap-2">
                {webResults.map((r, i) => {
                  const exists = localTitles.has(normalizeTitle(r.title));
                  return (
                    <div
                      key={i}
                      className="bg-gray-700 rounded-lg px-4 py-3 flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{r.title}</p>
                        <p className="text-xs text-gray-400">Himnario Kichwa</p>
                      </div>
                      {exists ? (
                        <span className="text-xs text-green-400 px-3 flex-shrink-0">
                          Ya en librería
                        </span>
                      ) : (
                        <button
                          className="px-3 py-1 text-xs bg-indigo-700 hover:bg-indigo-600 rounded disabled:opacity-40 flex-shrink-0"
                          onClick={() => handleAgregar(r)}
                          disabled={importLoading}
                        >
                          {importLoading ? 'Cargando...' : '+ Agregar'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <SongEditor
          songId={editingId}
          onSaved={handleSaved}
          onCancel={() => {
            setView('list');
            setInitialData(null);
          }}
          initialData={initialData}
        />
      )}
    </div>
  );
}
