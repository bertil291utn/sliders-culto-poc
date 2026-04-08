export const SLIDE_TYPE_COLORS = {
  song: 'bg-teal-700',
  reading: 'bg-yellow-700',
  message: 'bg-indigo-700',
  image: 'bg-purple-700',
  no_digital: 'bg-gray-600',
};

export const CULTO_TEMPLATES = [
  {
    id: 'culto-dominical',
    name: 'Culto dominical',
    description: 'Orden completo: bienvenida, alabanzas, mensaje, ofrendas y cierre',
    slides: [
      { position: 0,  type: 'no_digital', label: 'Bienvenida' },
      { position: 1,  type: 'reading',    label: 'Lectura de apertura' },
      { position: 2,  type: 'song',       label: 'Alabanza 1' },
      { position: 3,  type: 'song',       label: 'Alabanza 2' },
      { position: 4,  type: 'song',       label: 'Alabanza 3' },
      { position: 5,  type: 'reading',    label: 'Lectura bíblica' },
      { position: 6,  type: 'song',       label: 'Alabanza 4' },
      { position: 7,  type: 'song',       label: 'Alabanza 5' },
      { position: 8,  type: 'message',    label: 'Mensaje' },
      { position: 9,  type: 'no_digital', label: 'Ofrendas' },
      { position: 10, type: 'song',       label: 'Alabanza 6' },
      { position: 11, type: 'no_digital', label: 'Especiales' },
      { position: 12, type: 'message',    label: 'Anuncios' },
      { position: 13, type: 'no_digital', label: 'Oración y despedida' },
    ],
  },
];
