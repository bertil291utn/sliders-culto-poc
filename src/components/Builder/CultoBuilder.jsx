import { useState, useEffect } from 'react';
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
} from '@dnd-kit/sortable';
import {
  getSlots,
  createSlot,
  updateSlot,
  deleteSlot,
  reorderSlots,
  updateCulto,
} from '../../db/database';
import { deleteImage } from '../../db/imageStore';
import SortableSlide from './SortableSlide';
import SlideModal from './SlideModal';

export default function CultoBuilder({ culto, onChange }) {
  const [slides, setSlides] = useState([]);
  const [modal, setModal] = useState(null); // null | { slide: null } | { slide: slideObj }
  const [name, setName] = useState(culto.name);
  const [date, setDate] = useState(culto.date || '');
  const [color, setColor] = useState(culto.background_color || '#1e1b4b');

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    setSlides(getSlots(culto.id));
    setName(culto.name);
    setDate(culto.date || '');
    setColor(culto.background_color || '#1e1b4b');
  }, [culto.id]);

  function saveHeader() {
    updateCulto(culto.id, { name, date, background_color: color });
    onChange();
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(slides, oldIdx, newIdx);
    setSlides(reordered);
    reorderSlots(culto.id, reordered.map((s) => s.id));
  }

  function handleAddSlide(data) {
    const position = slides.length;
    createSlot({ culto_id: culto.id, position, ...data });
    setSlides(getSlots(culto.id));
    setModal(null);
  }

  function handleEditSlide(data) {
    updateSlot(modal.slide.id, {
      position: modal.slide.position,
      ...data,
    });
    setSlides(getSlots(culto.id));
    setModal(null);
  }

  function handleDeleteSlide(id) {
    if (confirm('¿Eliminar este slide?')) {
      const target = slides.find((s) => s.id === id);
      if (target?.type === 'image' && target?.content) deleteImage(target.content);
      deleteSlot(id);
      setSlides(getSlots(culto.id));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header del culto */}
      <div className="bg-gray-700 rounded-xl p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre del culto</label>
            <input
              className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Fecha</label>
            <input
              type="date"
              className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Color de fondo</label>
            <input
              type="color"
              className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <span className="text-gray-400 text-sm">{color}</span>
          </div>
          <div
            className="ml-auto w-12 h-8 "
          />
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium"
            onClick={saveHeader}
          >
            Guardar
          </button>
        </div>
      </div>

      {/* Slides */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-300">Orden del culto</h2>
          <button
            className="px-3 py-1 bg-teal-700 hover:bg-teal-600 rounded text-sm"
            onClick={() => setModal({ slide: null })}
          >
            + Agregar slide
          </button>
        </div>

        {slides.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No hay slides. Agrega el primero para comenzar.
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {slides.map((slide) => (
                <SortableSlide
                  key={slide.id}
                  slide={slide}
                  onEdit={(s) => setModal({ slide: s })}
                  onDelete={handleDeleteSlide}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {modal && (
        <SlideModal
          slide={modal.slide}
          onSave={modal.slide ? handleEditSlide : handleAddSlide}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
