import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { parseCultoText, extractSuggestedCultoName } from '../../utils/cultoTextParser';
import {
  resolveParsedItems,
  mergeTypicalDominicalStructure,
  previewNeedsTypicalStructure,
} from '../../utils/cultoImporter';
import { createCulto, createSlot } from '../../db/database';
import { SLIDE_TYPE_COLORS } from './templates';

const SLOT_TYPES = [
  { value: 'song', label: 'Alabanza' },
  { value: 'reading', label: 'Lectura' },
  { value: 'message', label: 'Mensaje / anuncios' },
  { value: 'no_digital', label: 'Sin digital' },
];

function statusBadge(row) {
  const { status, source } = row;
  if (status === 'library' || source === 'library') {
    return { text: 'En biblioteca', className: 'bg-green-900/80 text-green-200' };
  }
  if (status === 'kichwamusic' || source === 'kichwamusic') {
    return { text: 'Himnario web', className: 'bg-blue-900/80 text-blue-200' };
  }
  if (status === 'empty' || source === 'empty') {
    return { text: 'Vacía — completar', className: 'bg-amber-900/80 text-amber-200' };
  }
  if (source === 'template') {
    return { text: 'Plantilla', className: 'bg-gray-600 text-gray-200' };
  }
  return { text: 'Manual', className: 'bg-gray-600 text-gray-200' };
}

/**
 * @param {{
 *   row: { localId: string, type: string, label: string, song_id: number|null, source?: string, status?: string },
 *   badge: { text: string, className: string },
 *   color: string,
 *   onPatch: (localId: string, patch: object) => void,
 *   onRemove: (localId: string) => void,
 * }} props
 */
function SortableImportRow({ row, badge, color, onPatch, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.localId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-col sm:flex-row sm:items-stretch gap-2 bg-gray-900/60 border border-gray-600 rounded-lg p-3"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 select-none flex-shrink-0 self-start sm:self-center px-1 py-2 sm:py-0"
        title="Arrastrar para reordenar"
      >
        ⠿
      </div>
      <div
        className={`w-full sm:w-2 min-h-[6px] sm:min-h-0 rounded flex-shrink-0 sm:self-stretch ${color}`}
        aria-hidden
      />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
            value={row.type}
            onChange={(e) => {
              const t = e.target.value;
              onPatch(row.localId, {
                type: t,
                song_id: t === 'song' ? row.song_id : null,
              });
            }}
          >
            {SLOT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span className={`text-xs px-2 py-0.5 rounded ${badge.className}`}>{badge.text}</span>
          {row.type === 'song' && row.song_id && (
            <span className="text-xs text-gray-500">canción #{row.song_id}</span>
          )}
        </div>
        <input
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          value={row.label}
          onChange={(e) => onPatch(row.localId, { label: e.target.value })}
        />
      </div>
      <div className="flex gap-1 flex-shrink-0 self-end sm:self-center">
        <button
          type="button"
          className="px-2 py-1 bg-red-900/60 hover:bg-red-800 rounded text-xs"
          onClick={() => onRemove(row.localId)}
        >
          ×
        </button>
      </div>
    </li>
  );
}

/**
 * @param {{ onClose: () => void, onCreated: (cultoId: number) => void }} props
 */
export default function ImportCultoModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [paste, setPaste] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');

  const sensors = useSensors(useSensor(PointerSensor));

  async function handleProcess() {
    setError('');
    if (!paste.trim()) {
      setError('Pega el texto del orden del culto.');
      return;
    }
    const parsed = parseCultoText(paste);
    const suggested = extractSuggestedCultoName(parsed);
    setName((n) => (n.trim() ? n : suggested || n));
    setLoading(true);
    setProgress({ done: 0, total: 0 });
    try {
      const resolved = await resolveParsedItems(parsed, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setRows(
        resolved.map((r) => ({
          ...r,
          localId: crypto.randomUUID(),
        }))
      );
      setStep(2);
    } catch (e) {
      setError(e?.message || 'Error al procesar.');
    } finally {
      setLoading(false);
    }
  }

  function handleInsert(type, label) {
    setRows((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        type,
        label,
        song_id: null,
        content: '',
        source: 'manual',
        status: 'manual',
      },
    ]);
  }

  function applyTypical() {
    setRows((prev) => mergeTypicalDominicalStructure(prev));
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const oldIdx = prev.findIndex((r) => r.localId === active.id);
      const newIdx = prev.findIndex((r) => r.localId === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function removeRow(localId) {
    setRows((prev) => prev.filter((r) => r.localId !== localId));
  }

  function patchRow(localId, patch) {
    setRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }

  function handleCreateCulto() {
    setError('');
    if (!name.trim()) {
      setError('Indica un nombre para el culto.');
      return;
    }
    if (rows.length === 0) {
      setError('No hay slides en la vista previa.');
      return;
    }
    const id = createCulto({ name: name.trim(), date: date || '' });
    rows.forEach((r, position) => {
      createSlot({
        culto_id: id,
        position,
        type: r.type,
        label: (r.label || 'Slide').trim() || 'Slide',
        song_id: r.song_id ?? null,
        content: r.content ?? '',
      });
    });
    onCreated(id);
    onClose();
  }

  const showStructureBanner = step === 2 && previewNeedsTypicalStructure(rows);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-xl border border-gray-600">
        <div className="p-4 border-b border-gray-600 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-white">
            {step === 1 ? 'Importar desde texto' : 'Vista previa del culto'}
          </h2>
          <button
            type="button"
            className="text-gray-400 hover:text-white text-sm px-2"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded px-3 py-2">{error}</p>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-gray-400">
                Pega la lista (WhatsApp, notas, etc.). La app detectará alabanzas, lecturas y mensaje; luego
                buscará en tu biblioteca y en himnario.kichwamusic.com.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nombre del culto</label>
                  <input
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Culto 4 mayo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Fecha</label>
                  <input
                    type="date"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Texto del orden</label>
                <textarea
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono min-h-[220px] focus:outline-none focus:border-indigo-500"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder={'1. Gracia sublime\n577.K\nLectura bíblica\nMensaje\n...'}
                  disabled={loading}
                />
              </div>
              {loading && (
                <p className="text-sm text-indigo-300">
                  Buscando canciones… {progress.total ? `${progress.done} / ${progress.total}` : '…'}
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium disabled:opacity-40"
                  onClick={handleProcess}
                  disabled={loading}
                >
                  {loading ? 'Procesando…' : 'Procesar'}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nombre del culto</label>
                  <input
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Fecha</label>
                  <input
                    type="date"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              {showStructureBanner && (
                <div className="rounded-lg border border-amber-700/80 bg-amber-950/30 px-3 py-2 text-sm text-amber-100 flex flex-col gap-2">
                  <span>
                    No se detectaron algunas partes típicas (lectura, mensaje u ofrendas). Podés insertarlas
                    con el orden aproximado del culto dominical.
                  </span>
                  <button
                    type="button"
                    className="self-start px-3 py-1 bg-amber-800 hover:bg-amber-700 rounded text-xs font-medium"
                    onClick={applyTypical}
                  >
                    Aplicar orden típico (dominical)
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-2 py-1 bg-yellow-800/80 hover:bg-yellow-700 rounded text-xs"
                  onClick={() => handleInsert('reading', 'Lectura')}
                >
                  + Lectura
                </button>
                <button
                  type="button"
                  className="px-2 py-1 bg-indigo-800/80 hover:bg-indigo-700 rounded text-xs"
                  onClick={() => handleInsert('message', 'Mensaje')}
                >
                  + Mensaje
                </button>
                <button
                  type="button"
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                  onClick={() => handleInsert('no_digital', 'Ofrendas')}
                >
                  + Ofrenda
                </button>
                <button
                  type="button"
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                  onClick={() => handleInsert('no_digital', 'Bienvenida')}
                >
                  + Bienvenida
                </button>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={rows.map((r) => r.localId)} strategy={verticalListSortingStrategy}>
                  <ul className="flex flex-col gap-2">
                    {rows.map((row) => (
                      <SortableImportRow
                        key={row.localId}
                        row={row}
                        badge={statusBadge(row)}
                        color={SLIDE_TYPE_COLORS[row.type] || 'bg-gray-600'}
                        onPatch={patchRow}
                        onRemove={removeRow}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              {rows.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Sin ítems.</p>}

              <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-600">
                <button
                  type="button"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium disabled:opacity-40"
                  onClick={handleCreateCulto}
                  disabled={rows.length === 0}
                >
                  Crear culto
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                  onClick={() => {
                    setStep(1);
                    setRows([]);
                    setError('');
                  }}
                >
                  Volver
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
