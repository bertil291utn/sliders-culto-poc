import { useState, useEffect, useRef, useCallback } from 'react';
import { getCultos, getSlots, getSongLines, reorderSlots } from '../../db/database';
import { useBroadcastSender, useBroadcastReceiver } from '../../hooks/useBroadcast';
import { getImageUrl } from '../../db/imageStore';
import SlideNav from './SlideNav';
import TempoSlider from './TempoSlider';

export default function OperatorPanel() {
  const [cultos, setCultos] = useState([]);
  const [cultoId, setCultoId] = useState('');
  const [slides, setSlides] = useState([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [lines, setLines] = useState([]);
  const [tempo, setTempo] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [projectionConnected, setProjectionConnected] = useState(false);
  const timerRef = useRef(null);
  const previewImageUrlRef = useRef('');
  const send = useBroadcastSender();

  // On mount: probe for an already-open projection tab
  useEffect(() => {
    const t = setTimeout(() => {
      const ch = new BroadcastChannel('culto-presentation');
      ch.postMessage({ type: 'REQUEST_PROJECTION_STATUS' });
      ch.close();
    }, 100);
    return () => clearTimeout(t);
  }, []);

  // Load cultos list — restore last selected culto from localStorage
  useEffect(() => {
    const list = getCultos();
    setCultos(list);
    if (list.length === 0) return;
    const saved = localStorage.getItem('operator_cultoId');
    const match = saved && list.find((c) => String(c.id) === saved);
    setCultoId(match ? String(match.id) : String(list[0].id));
  }, []);

  // Persist selected culto
  useEffect(() => {
    if (cultoId) localStorage.setItem('operator_cultoId', String(cultoId));
  }, [cultoId]);

  // Load slides when culto changes
  useEffect(() => {
    if (!cultoId) return;
    const s = getSlots(cultoId);
    setSlides(s);
    setSlideIdx(0);
    setLineIdx(0);
  }, [cultoId]);

  // Load lines for current slide (only song slides have line-by-line content)
  useEffect(() => {
    const slide = slides[slideIdx];
    if (!slide) { setLines([]); return; }
    if (slide.type === 'song' && slide.song_id) {
      setLines(getSongLines(slide.song_id).map((l) => l.text));
    } else {
      setLines([]);
    }
    setLineIdx(0);

    // Load image preview URL for image slides
    if (previewImageUrlRef.current) {
      URL.revokeObjectURL(previewImageUrlRef.current);
      previewImageUrlRef.current = '';
      setPreviewImageUrl('');
    }
    if (slide.type === 'image' && slide.content) {
      getImageUrl(slide.content).then((url) => {
        if (url) {
          previewImageUrlRef.current = url;
          setPreviewImageUrl(url);
        }
      });
    }
  }, [slideIdx, slides]);

  // Broadcast whenever presentation state changes
  const broadcast = useCallback(() => {
    const slide = slides[slideIdx];
    if (!slide) return;
    send({
      type: 'STATE',
      slide,
      slideIdx,
      lineIdx,
      lines,
      isPlaying,
      tempo,
      bgColor: (() => {
        const culto = cultos.find((c) => c.id === Number(cultoId));
        return culto?.background_color || '#1e1b4b';
      })(),
    });
  }, [slides, slideIdx, lineIdx, lines, isPlaying, tempo, cultoId, cultos, send]);

  useEffect(() => { broadcast(); }, [broadcast]);

  // Re-broadcast when projection page requests state; track projection tab presence
  useBroadcastReceiver((msg) => {
    if (msg.type === 'REQUEST_STATE') broadcast();
    if (msg.type === 'PROJECTION_CONNECTED') setProjectionConnected(true);
    if (msg.type === 'PROJECTION_DISCONNECTED') setProjectionConnected(false);
  });

  // Auto-advance timer — only advances lines for 'song' slides
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      const currentType = slides[slideIdx]?.type;
      if (currentType !== 'song') return;
      setLineIdx((prev) => {
        const next = prev + 1;
        if (next >= lines.length) {
          setSlideIdx((si) => {
            const nextSi = si + 1;
            if (nextSi < slides.length) return nextSi;
            setIsPlaying(false);
            return si;
          });
          return 0;
        }
        return next;
      });
    }, tempo * 1000);
    return () => clearInterval(timerRef.current);
  }, [isPlaying, tempo, lines.length, slides.length, slideIdx, slides]);

  function handleReorder(reordered) {
    const currentId = slides[slideIdx]?.id;
    setSlides(reordered);
    reorderSlots(cultoId, reordered.map((s) => s.id));
    if (currentId !== undefined) {
      const newIdx = reordered.findIndex((s) => s.id === currentId);
      if (newIdx !== -1) setSlideIdx(newIdx);
    }
  }

  function manualNext() {
    const isSong = slides[slideIdx]?.type === 'song';
    // Keep auto-playing on song slides; only stop for non-song slides
    if (!(isPlaying && isSong)) {
      setIsPlaying(false);
      clearInterval(timerRef.current);
    }
    if (isSong && lineIdx < lines.length - 1) {
      setLineIdx((i) => i + 1);
    } else if (slideIdx < slides.length - 1) {
      setSlideIdx((i) => i + 1);
      setLineIdx(0);
    }
  }

  function manualPrev() {
    const isSong = slides[slideIdx]?.type === 'song';
    if (!(isPlaying && isSong)) {
      setIsPlaying(false);
      clearInterval(timerRef.current);
    }
    if (isSong && lineIdx > 0) {
      setLineIdx((i) => i - 1);
    } else if (slideIdx > 0) {
      setSlideIdx((i) => i - 1);
      setLineIdx(0);
    }
  }

  const currentSlide = slides[slideIdx];
  const isSongSlide = currentSlide?.type === 'song';
  const totalLines = lines.length;
  const bgColor = (() => {
    const culto = cultos.find((c) => c.id === Number(cultoId));
    return culto?.background_color || '#1e1b4b';
  })();

  return (
    <div className="flex gap-4 h-full">
      {/* Sidebar: slide list */}
      <div className="w-64 flex-shrink-0 bg-gray-900 rounded-xl p-3 overflow-y-auto">
        <div className="mb-3">
          <select
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none"
            value={cultoId}
            onChange={(e) => setCultoId(e.target.value)}
          >
            <option value="">-- Seleccionar culto --</option>
            {cultos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.date ? ` · ${c.date}` : ''}
              </option>
            ))}
          </select>
        </div>
        <SlideNav
          slides={slides}
          activeIdx={slideIdx}
          onSelect={(i) => { setSlideIdx(i); setLineIdx(0); setIsPlaying(false); }}
          onReorder={handleReorder}
        />
      </div>

      {/* Main controls */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Current slide preview */}
        <div
          className="rounded-xl flex flex-col items-center justify-center min-h-[200px] p-8 gap-4 text-center overflow-hidden"
          style={{ backgroundColor: bgColor }}
        >
          {!currentSlide ? (
            <p className="text-gray-400">Selecciona un culto con slides</p>
          ) : currentSlide.type === 'image' ? (
            previewImageUrl
              ? <img src={previewImageUrl} alt="" className="max-w-full max-h-40 object-contain rounded" />
              : <p className="text-white/40 text-2xl">{currentSlide.content ? 'Cargando imagen...' : 'Sin imagen'}</p>
          ) : isSongSlide && lines.length > 0 ? (
            <>
              <p className="text-white/50 text-sm">{lines[lineIdx - 1] || '\u00a0'}</p>
              <p className="text-white text-2xl font-bold">{lines[lineIdx] || '\u00a0'}</p>
              <p className="text-white/50 text-sm">{lines[lineIdx + 1] || '\u00a0'}</p>
              {totalLines > 0 && (
                <p className="text-white/30 text-xs mt-2">
                  Línea {lineIdx + 1} / {totalLines}
                </p>
              )}
            </>
          ) : (
            <p className="text-white text-2xl font-bold">{currentSlide.label}</p>
          )}
        </div>

        {/* Transport controls */}
        <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-center gap-3">
            <button
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
              onClick={manualPrev}
            >
              ← Anterior
            </button>
            <button
              className={`px-6 py-2 rounded-lg font-bold ${
                isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-green-600 hover:bg-green-500'
              } ${!isSongSlide ? 'opacity-40 cursor-not-allowed' : ''}`}
              onClick={() => isSongSlide && setIsPlaying((p) => !p)}
              title={!isSongSlide ? 'Auto solo disponible para slides de canción' : ''}
            >
              {isPlaying ? '⏸ Pausar' : '▶ Auto'}
            </button>
            <button
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
              onClick={manualNext}
            >
              Siguiente →
            </button>
          </div>

          <TempoSlider
            tempo={tempo}
            onChange={(v) => setTempo(v)}
            disabled={!isSongSlide}
          />

            <button
              className={`rounded-lg ml-2 px-2 py-0.5 ${projectionConnected ? 'bg-gray-600 opacity-40 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}
              onClick={() => !projectionConnected && window.open('/projection', '_blank')}
            >
              {projectionConnected ? '✓ Proyección activa' : '▶ Iniciar proyección'}
            </button>
        </div>
      </div>
    </div>
  );
}
