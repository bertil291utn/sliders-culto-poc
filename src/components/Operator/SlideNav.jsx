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

const TYPE_DOT = {
  song: 'bg-teal-500',
  reading: 'bg-yellow-500',
  message: 'bg-indigo-500',
  image: 'bg-purple-500',
  no_digital: 'bg-gray-500',
};

function SortableSlideItem({ slide, index, activeIdx, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-2 rounded transition-colors group ${
        isDragging
          ? 'opacity-40 bg-gray-600'
          : index === activeIdx
          ? 'bg-indigo-700 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 px-1 select-none"
        title="Arrastrar para reordenar"
      >
        ⠿
      </span>
      <button
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
        onClick={() => onSelect(index)}
      >
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[slide.type] || TYPE_DOT.no_digital}`}
        />
        <span className="truncate text-sm">{slide.label}</span>
        {slide.song_title && (
          <span className="text-xs text-gray-400 ml-auto truncate max-w-[80px]">
            {slide.song_title}
          </span>
        )}
      </button>
    </div>
  );
}

export default function SlideNav({ slides, activeIdx, onSelect, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    onReorder(arrayMove(slides, oldIdx, newIdx));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {slides.map((slide, i) => (
            <SortableSlideItem
              key={slide.id}
              slide={slide}
              index={i}
              activeIdx={activeIdx}
              onSelect={onSelect}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
