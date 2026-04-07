import { useState } from 'react';
import SongList from '../components/Library/SongList';
import SongEditor from '../components/Library/SongEditor';

export default function LibraryPage() {
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [editingId, setEditingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleNew() {
    setEditingId(null);
    setView('editor');
  }

  function handleEdit(id) {
    setEditingId(id);
    setView('editor');
  }

  function handleSaved() {
    setRefreshKey((k) => k + 1);
    setView('list');
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {view === 'list' ? 'Librería de canciones' : editingId ? 'Editar canción' : 'Nueva canción'}
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
        <SongList onEdit={handleEdit} refreshKey={refreshKey} />
      ) : (
        <SongEditor
          songId={editingId}
          onSaved={handleSaved}
          onCancel={() => setView('list')}
        />
      )}
    </div>
  );
}
