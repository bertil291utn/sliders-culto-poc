import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { getCultos, getSlots, getSongLines, reorderSlots } from '../../db/database';
import { useBroadcastSender, useBroadcastReceiver } from '../../hooks/useBroadcast';
import { getImageUrl } from '../../db/imageStore';
import SlideNav from './SlideNav';
import TempoSlider from './TempoSlider';
import {
  openProjectionWindow,
  primeScreenManagement,
  attachExistingProjectionWindow,
} from '../../utils/screenManager';

const PROJECTION_POPUP_STORAGE_KEY = 'culto_operator_projection_popup';

function readProjectionPopupStored() {
  try {
    return sessionStorage.getItem(PROJECTION_POPUP_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeProjectionPopupStored(on) {
  try {
    if (on) sessionStorage.setItem(PROJECTION_POPUP_STORAGE_KEY, '1');
    else sessionStorage.removeItem(PROJECTION_POPUP_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const OPERATOR_SESSION_KEY = 'culto_operator_session';

function readOperatorSession() {
  try {
    const raw = sessionStorage.getItem(OPERATOR_SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

function writeOperatorSession(payload) {
  try {
    sessionStorage.setItem(OPERATOR_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function initialOperatorSessionValues() {
  const snap = readOperatorSession();
  return {
    tempo:
      typeof snap?.tempo === 'number' && snap.tempo >= 1 && snap.tempo <= 30
        ? snap.tempo
        : 3,
    isPlaying: typeof snap?.isPlaying === 'boolean' ? snap.isPlaying : false,
    projectionFullscreen: Boolean(snap?.projectionFullscreen),
  };
}

const PROJECTION_BANNER_TEXT = {
  'fallback-single-screen':
    'Solo se detectó una pantalla. Conecta el proyector para usar modo presentador. Abriendo en esta ventana para vista previa.',
  'fallback-unsupported':
    'Tu navegador no soporta apertura automática en el proyector. Arrastra la nueva pestaña al proyector.',
  'fallback-denied':
    'Permiso denegado. Habilita «Administrar ventanas» en la barra de direcciones para la apertura automática.',
  blocked: 'No se pudo abrir la ventana. Permite ventanas emergentes para este sitio.',
};

export default function OperatorPanel() {
  const [cultos, setCultos] = useState([]);
  const [cultoId, setCultoId] = useState('');
  const [slides, setSlides] = useState([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [lines, setLines] = useState([]);
  const [tempo, setTempo] = useState(() => initialOperatorSessionValues().tempo);
  const [isPlaying, setIsPlaying] = useState(() => initialOperatorSessionValues().isPlaying);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [projectionConnected, setProjectionConnected] = useState(false);
  const [projectionWinOpen, setProjectionWinOpen] = useState(readProjectionPopupStored);
  const [projectionFullscreen, setProjectionFullscreen] = useState(
    () => initialOperatorSessionValues().projectionFullscreen,
  );
  const [projectionBanner, setProjectionBanner] = useState(null);
  const [openingProjection, setOpeningProjection] = useState(false);
  const timerRef = useRef(null);
  const previewImageUrlRef = useRef('');
  const projectionWinRef = useRef(null);
  const pendingLineIdxRestore = useRef(null);
  const prevSlideIdForLinesRef = useRef(null);
  const hasHydratedOperatorSessionRef = useRef(false);
  const send = useBroadcastSender();

  // Warm up Window Management API + cache screens (permission prompt first visit)
  useEffect(() => {
    primeScreenManagement().catch(() => {});
  }, []);

  // After SPA navigation away and back: recover Window ref + sync UI with sessionStorage
  useLayoutEffect(() => {
    if (!readProjectionPopupStored()) return;
    const w = attachExistingProjectionWindow();
    if (w) {
      projectionWinRef.current = w;
      setProjectionWinOpen(true);
      return;
    }
    writeProjectionPopupStored(false);
    setProjectionWinOpen(false);
  }, []);

  // Projection tab already open (e.g. other route had no storage): reattach named popup
  useLayoutEffect(() => {
    if (!projectionConnected) return;
    if (projectionWinRef.current && !projectionWinRef.current.closed) return;
    const w = attachExistingProjectionWindow();
    if (!w) return;
    projectionWinRef.current = w;
    setProjectionWinOpen(true);
    writeProjectionPopupStored(true);
  }, [projectionConnected]);

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

  // Load slides when culto changes — restore slide / line / transport from session when same culto
  useEffect(() => {
    if (!cultoId) return;
    prevSlideIdForLinesRef.current = null;
    const s = getSlots(cultoId);
    setSlides(s);
    const snap = readOperatorSession();
    if (
      snap &&
      String(snap.cultoId) === String(cultoId) &&
      typeof snap.slideIdx === 'number' &&
      s.length > 0
    ) {
      const si = Math.max(0, Math.min(Math.floor(snap.slideIdx), s.length - 1));
      setSlideIdx(si);
      if (typeof snap.lineIdx === 'number') {
        pendingLineIdxRestore.current = Math.max(0, Math.floor(snap.lineIdx));
      } else {
        pendingLineIdxRestore.current = null;
      }
      if (typeof snap.tempo === 'number' && snap.tempo >= 1 && snap.tempo <= 30) {
        setTempo(snap.tempo);
      }
      if (typeof snap.isPlaying === 'boolean') {
        setIsPlaying(snap.isPlaying);
      }
      if (typeof snap.projectionFullscreen === 'boolean') {
        setProjectionFullscreen(snap.projectionFullscreen);
      }
    } else {
      setSlideIdx(0);
      pendingLineIdxRestore.current = null;
      setTempo(3);
      setIsPlaying(false);
    }
    hasHydratedOperatorSessionRef.current = true;
  }, [cultoId]);

  // Load lines for current slide; reset line only when the slide identity changes (not on session restore)
  useEffect(() => {
    const slide = slides[slideIdx];
    if (!slide) {
      setLines([]);
      prevSlideIdForLinesRef.current = null;
      return;
    }

    const slideId = slide.id;
    const hadPrevious = prevSlideIdForLinesRef.current !== null;
    const slideChangedByUser = hadPrevious && prevSlideIdForLinesRef.current !== slideId;

    if (previewImageUrlRef.current) {
      URL.revokeObjectURL(previewImageUrlRef.current);
      previewImageUrlRef.current = '';
      setPreviewImageUrl('');
    }

    if (slide.type === 'song' && slide.song_id) {
      const newLines = getSongLines(slide.song_id).map((l) => l.text);
      setLines(newLines);
      if (pendingLineIdxRestore.current !== null) {
        const maxL = Math.max(0, newLines.length - 1);
        setLineIdx(Math.min(pendingLineIdxRestore.current, maxL));
        pendingLineIdxRestore.current = null;
      } else if (slideChangedByUser) {
        setLineIdx(0);
      } else {
        setLineIdx((i) => Math.min(i, Math.max(0, newLines.length - 1)));
      }
    } else {
      setLines([]);
      pendingLineIdxRestore.current = null;
      if (slideChangedByUser) setLineIdx(0);
    }

    prevSlideIdForLinesRef.current = slideId;

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
    if (msg.type === 'PROJECTION_DISCONNECTED') {
      setProjectionConnected(false);
      writeProjectionPopupStored(false);
    }
    if (msg.type === 'FULLSCREEN_STATE') setProjectionFullscreen(Boolean(msg.fullscreen));
  });

  // Persist operator presentation UI across SPA routes (same tab)
  useEffect(() => {
    if (!hasHydratedOperatorSessionRef.current || !cultoId) return;
    writeOperatorSession({
      cultoId: String(cultoId),
      slideIdx,
      lineIdx,
      tempo,
      isPlaying,
      projectionFullscreen,
    });
  }, [cultoId, slideIdx, lineIdx, tempo, isPlaying, projectionFullscreen]);

  // Detect projection popup closed without relying on ref during render (refs don't re-render)
  useEffect(() => {
    if (!projectionWinOpen) return;
    const id = setInterval(() => {
      if (!projectionWinRef.current || projectionWinRef.current.closed) {
        projectionWinRef.current = null;
        setProjectionWinOpen(false);
        setProjectionFullscreen(false);
        writeProjectionPopupStored(false);
      }
    }, 500);
    return () => clearInterval(id);
  }, [projectionWinOpen]);

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

  function handleStopProjection() {
    const win = projectionWinRef.current;
    if (win && !win.closed) {
      try {
        win.close();
      } catch {
        // Some browsers refuse to close windows opened by other contexts; ignored.
      }
    }
    projectionWinRef.current = null;
    setProjectionWinOpen(false);
    setProjectionFullscreen(false);
    setProjectionConnected(false);
    setProjectionBanner(null);
    writeProjectionPopupStored(false);
  }

  function requestProjectionFullscreen() {
    const win = projectionWinRef.current;
    if (!win || win.closed) return;
    try {
      win.focus();
    } catch {
      // ignored
    }
    // Capability Delegation: postMessage's *options* form (second argument) lets us
    // transfer this click's transient activation so the projection window can call
    // requestFullscreen() without its own gesture.
    // Caveat: passing options as 3rd arg is silently ignored — that's `transfer`.
    try {
      win.postMessage(
        { type: 'REQUEST_FULLSCREEN' },
        { targetOrigin: window.location.origin, delegate: 'fullscreen' },
      );
    } catch {
      try {
        win.postMessage({ type: 'REQUEST_FULLSCREEN' }, window.location.origin);
      } catch {
        // ignored
      }
    }
  }

  async function handleStartProjection() {
    if (openingProjection) return;

    if (projectionWinRef.current && !projectionWinRef.current.closed) {
      projectionWinRef.current.focus();
      setProjectionWinOpen(true);
      writeProjectionPopupStored(true);
      setProjectionBanner(null);
      return;
    }

    const attached = attachExistingProjectionWindow();
    if (attached) {
      projectionWinRef.current = attached;
      setProjectionWinOpen(true);
      writeProjectionPopupStored(true);
      try {
        attached.focus();
      } catch {
        /* ignore */
      }
      setProjectionBanner(null);
      return;
    }

    // /projection is open without the named popup (e.g. manual tab) — do not open a second window
    if (projectionConnected && !projectionWinOpen) return;

    setOpeningProjection(true);
    try {
      const { win, mode } = await openProjectionWindow('/projection');
      projectionWinRef.current = win;
      if (!win) {
        setProjectionBanner('blocked');
        setProjectionWinOpen(false);
        writeProjectionPopupStored(false);
        return;
      }
      setProjectionWinOpen(true);
      writeProjectionPopupStored(true);
      setProjectionBanner(mode === 'projector' ? null : mode);
    } finally {
      setOpeningProjection(false);
    }
  }

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
          role={projectionWinOpen && !projectionFullscreen ? 'button' : undefined}
          tabIndex={projectionWinOpen && !projectionFullscreen ? 0 : undefined}
          onClick={projectionWinOpen && !projectionFullscreen ? requestProjectionFullscreen : undefined}
          onKeyDown={
            projectionWinOpen && !projectionFullscreen
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    requestProjectionFullscreen();
                  }
                }
              : undefined
          }
          className={`relative rounded-xl flex flex-col items-center justify-center min-h-[200px] p-8 gap-4 text-center overflow-hidden ${
            projectionWinOpen && !projectionFullscreen ? 'cursor-pointer ring-2 ring-white/30' : ''
          }`}
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
          ) : currentSlide.type === 'reading' || currentSlide.type === 'message' ? (
            <div className="flex flex-col items-center gap-3 w-full text-center">
              {currentSlide.label && (
                <p className="text-white/50 text-sm font-medium">{currentSlide.label}</p>
              )}
              {currentSlide.content ? (
                currentSlide.content.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className="text-white text-xl font-bold leading-snug">{line}</p>
                ))
              ) : (
                <p className="text-white/30 text-lg">Sin contenido</p>
              )}
            </div>
          ) : (
            <p className="text-white text-2xl font-bold">{currentSlide.label}</p>
          )}
          {projectionWinOpen && !projectionFullscreen && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl pointer-events-none">
              <span className="text-white text-lg font-semibold tracking-wide px-4 text-center">
                Clic para pantalla completa
              </span>
            </div>
          )}
        </div>

        {/* Transport controls */}
        <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-4">
          {projectionBanner && (
            <div
              role="status"
              className="rounded-lg bg-amber-900/80 border border-amber-700 text-amber-100 text-sm px-3 py-2 flex justify-between gap-3 items-start"
            >
              <span>{PROJECTION_BANNER_TEXT[projectionBanner] ?? projectionBanner}</span>
              <button
                type="button"
                className="text-amber-200 hover:text-white shrink-0 underline text-xs"
                onClick={() => setProjectionBanner(null)}
              >
                Cerrar
              </button>
            </div>
          )}
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

          <div className="flex items-center justify-center gap-2 ml-2">
           {(!projectionWinOpen)&&( <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                projectionConnected && !projectionWinOpen
                  ? 'bg-gray-600 opacity-60 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500'
              }`}
              disabled={openingProjection || (projectionConnected && !projectionWinOpen)}
              onClick={handleStartProjection}
              // title={
              //   projectionWinOpen ? 'Traer la ventana de proyección al frente' : undefined
              // }
            >
              {/* {openingProjection
                ? 'Abriendo…'
                // : projectionWinOpen
                //   ? '✓ Proyección — enfocar'
                  : projectionConnected
                    ? '✓ Proyección activa' */}
                    ▶ Iniciar proyección
            </button>)}
            {projectionWinOpen && (
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium bg-red-600 hover:bg-red-500"
                onClick={handleStopProjection}
                title="Cerrar la ventana de proyección"
              >
                ■ Detener proyección
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
