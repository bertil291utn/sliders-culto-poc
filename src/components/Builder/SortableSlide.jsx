import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TYPE_STYLES = {
  song: 'border-teal-600 bg-teal-900/30',
  reading: 'border-yellow-600 bg-yellow-900/30',
  message: 'border-indigo-600 bg-indigo-900/30',
  image: 'border-purple-600 bg-purple-900/30',
  no_digital: 'border-gray-600 bg-gray-700/50',
};

const TYPE_LABELS = {
  song: 'Canción',
  reading: 'Lectura',
  message: 'Mensaje',
  image: 'Imagen',
  no_digital: 'Sin digital',
};

export default function SortableSlide({ slide, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${TYPE_STYLES[slide.type] || TYPE_STYLES.no_digital}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 select-none"
        title="Arrastrar para reordenar"
      >
        ⠿
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{slide.label}</p>
        <p className="text-xs text-gray-400">
          {TYPE_LABELS[slide.type]}
          {slide.song_title ? ` · ${slide.song_title}` : ''}
          {!slide.song_id && slide.type === 'song' ? ' · Sin canción asignada' : ''}
        </p>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <button
          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          onClick={() => onEdit(slide)}
        >
          Editar
        </button>
        <button
          className="px-3 py-1 text-xs bg-red-800 hover:bg-red-700 rounded"
          onClick={() => onDelete(slide.id)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
