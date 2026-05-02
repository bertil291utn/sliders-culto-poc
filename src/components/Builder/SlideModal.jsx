import { useState, useEffect, useRef } from 'react';
import { saveImage, getImageUrl, deleteImage } from '../../db/imageStore';
import SongCombobox from './SongCombobox';

const SLIDE_TYPES = [
  { value: 'song', label: 'Canción karaoke', color: 'bg-teal-700' },
  { value: 'reading', label: 'Texto / pasaje bíblico', color: 'bg-yellow-700' },
  { value: 'message', label: 'Mensaje / palabra', color: 'bg-indigo-700' },
  { value: 'image', label: 'Imagen', color: 'bg-purple-700' },
  { value: 'no_digital', label: 'Sin contenido digital', color: 'bg-gray-600' },
];

export default function SlideModal({ slide, onSave, onClose }) {
  const [type, setType] = useState(slide?.type || 'song');
  const [label, setLabel] = useState(slide?.label || '');
  const [songId, setSongId] = useState(slide?.song_id || '');
  const [content, setContent] = useState(slide?.content || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Load existing image preview when editing an image slide
  useEffect(() => {
    if (slide?.type === 'image' && slide?.content) {
      getImageUrl(slide.content).then((url) => {
        if (url) setImagePreview(url);
      });
    }
    return () => {
      // Revoke preview URLs created locally (not from existing IndexedDB entry)
      if (imageFile && imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, []);

  function handleImageFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imagePreview && imageFile) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSave() {
    if (!label.trim() || saving) return;
    setSaving(true);

    let imageKey = type === 'image' ? (slide?.content || '') : '';

    if (type === 'image' && imageFile) {
      // Delete old blob if replacing
      if (slide?.content) await deleteImage(slide.content);
      imageKey = crypto.randomUUID();
      await saveImage(imageKey, imageFile);
    }

    onSave({
      type,
      label,
      song_id: type === 'song' ? (songId || null) : null,
      content: type === 'reading' || type === 'message' ? content
             : type === 'image' ? imageKey
             : '',
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg p-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold">{slide ? 'Editar slide' : 'Nuevo slide'}</h2>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Tipo de slide</label>
          <div className="grid grid-cols-2 gap-2">
            {SLIDE_TYPES.map((t) => (
              <button
                key={t.value}
                className={`px-3 py-2 rounded text-sm text-left transition-all border-2 ${
                  type === t.value
                    ? `${t.color} border-white text-white`
                    : 'bg-gray-700 border-transparent text-gray-300 hover:bg-gray-600'
                }`}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Etiqueta del slide *</label>
          <input
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={
              type === 'song' ? 'Canción 1'
              : type === 'reading' ? 'Lectura bíblica'
              : type === 'message' ? 'Mensaje del pastor'
              : type === 'image' ? 'Fondo de bienvenida'
              : 'Ofrendas'
            }
          />
        </div>

        {type === 'song' && (
          <SongCombobox
            songId={songId ? Number(songId) : null}
            label=""
            labelText="Canción"
            onCommit={({ song_id }) => {
              setSongId(song_id == null ? '' : song_id);
            }}
          />
        )}

        {(type === 'reading' || type === 'message') && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {type === 'reading' ? 'Texto bíblico' : 'Notas del mensaje'}
            </label>
            <textarea
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                type === 'reading'
                  ? 'Juan 3:16 — Porque de tal manera amó Dios al mundo...'
                  : 'Tema: La gracia de Dios...'
              }
            />
          </div>
        )}

        {type === 'image' && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">Imagen</label>
            {imagePreview ? (
              <div className="relative mb-2">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="w-full h-32 object-cover rounded border border-gray-600"
                />
                <button
                  className="absolute top-1 right-1 px-2 py-0.5 bg-black/60 hover:bg-black/80 rounded text-xs text-white"
                  onClick={clearImage}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div
                className="w-full h-32 border-2 border-dashed border-gray-600 rounded flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-500 transition-colors mb-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="text-gray-500 text-4xl leading-none">🖼</span>
                <span className="text-sm text-gray-500">Haz clic para subir imagen</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageFile}
            />
            {!imagePreview && (
              <button
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300"
                onClick={() => fileInputRef.current?.click()}
              >
                Seleccionar imagen desde el PC
              </button>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium disabled:opacity-40"
            onClick={handleSave}
            disabled={!label.trim() || saving}
          >
            {saving ? 'Guardando...' : slide ? 'Guardar' : 'Agregar'}
          </button>
          <button
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
