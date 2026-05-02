import { useState, useEffect, useRef } from 'react';
import { useBroadcastReceiver } from '../hooks/useBroadcast';
import { getImageUrl } from '../db/imageStore';
import KaraokeDisplay from '../components/Projection/KaraokeDisplay';
import TextDisplay from '../components/Projection/TextDisplay';
import TitleDisplay from '../components/Projection/TitleDisplay';
import ImageDisplay from '../components/Projection/ImageDisplay';

export default function ProjectionPage() {
  const [state, setState] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const imageUrlRef = useRef('');

  useBroadcastReceiver((msg) => {
    if (msg.type === 'STATE') setState(msg);
    if (msg.type === 'REQUEST_PROJECTION_STATUS') {
      const ch = new BroadcastChannel('culto-presentation');
      ch.postMessage({ type: 'PROJECTION_CONNECTED' });
      ch.postMessage({
        type: 'FULLSCREEN_STATE',
        fullscreen: Boolean(document.fullscreenElement),
      });
      ch.close();
    }
    // REQUEST_FULLSCREEN is now delivered via postMessage with capability delegation
    // (BroadcastChannel cannot transfer user activation). See effect below.
  });

  // Receive REQUEST_FULLSCREEN with delegated user activation from the operator window.
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== 'REQUEST_FULLSCREEN') return;
      if (document.fullscreenElement) return;
      document.documentElement.requestFullscreen().catch(() => {});
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // On mount: announce presence + request current state; announce disconnect on close
  useEffect(() => {
    const ch = new BroadcastChannel('culto-presentation');
    ch.postMessage({ type: 'PROJECTION_CONNECTED' });
    const t = setTimeout(() => ch.postMessage({ type: 'REQUEST_STATE' }), 150);
    const handleUnload = () => ch.postMessage({ type: 'PROJECTION_DISCONNECTED' });
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      clearTimeout(t);
      window.removeEventListener('beforeunload', handleUnload);
      ch.postMessage({ type: 'PROJECTION_DISCONNECTED' });
      ch.close();
    };
  }, []);

  // Safety net: opener may open with fullscreen feature (Chromium); if not, enter fullscreen here.
  // Synchronous requestFullscreen preserves transient activation when the popup first loads.
  useEffect(() => {
    const el = document.documentElement;
    if (!el.requestFullscreen) return;
    el.requestFullscreen().catch(() => {});
  }, []);

  // Publish fullscreen state so the operator can show / hide the preview overlay
  useEffect(() => {
    const ch = new BroadcastChannel('culto-presentation');
    const publish = () => {
      ch.postMessage({
        type: 'FULLSCREEN_STATE',
        fullscreen: Boolean(document.fullscreenElement),
      });
    };
    document.addEventListener('fullscreenchange', publish);
    publish();
    return () => {
      document.removeEventListener('fullscreenchange', publish);
      ch.close();
    };
  }, []);

  // Fallback: any click / key press inside the projection window forces fullscreen.
  useEffect(() => {
    const tryFs = () => {
      if (document.fullscreenElement) return;
      document.documentElement.requestFullscreen().catch(() => {});
    };
    window.addEventListener('click', tryFs);
    window.addEventListener('keydown', tryFs);
    return () => {
      window.removeEventListener('click', tryFs);
      window.removeEventListener('keydown', tryFs);
    };
  }, []);

  // Load image blob URL from IndexedDB when slide type is image
  useEffect(() => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = '';
      setImageUrl('');
    }
    const slide = state?.slide;
    if (slide?.type === 'image' && slide?.content) {
      getImageUrl(slide.content).then((url) => {
        if (url) {
          imageUrlRef.current = url;
          setImageUrl(url);
        }
      });
    }
  }, [state?.slide?.content]);

  if (!state) {
    return (
      <div className="w-screen h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-600 text-xl">Esperando conexión con el panel del operador...</p>
      </div>
    );
  }

  const { slide, lineIdx, lines, bgColor } = state;

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{ backgroundColor: bgColor || '#1e1b4b' }}
    >
      {slide.type === 'song' && lines.length > 0 && (
        <KaraokeDisplay lines={lines} lineIdx={lineIdx} />
      )}
      {(slide.type === 'reading' || slide.type === 'message') && (
        <TextDisplay content={slide.content} label={slide.label} />
      )}
      {slide.type === 'image' && (
        <ImageDisplay imageData={imageUrl} />
      )}
      {(slide.type === 'no_digital' || (slide.type === 'song' && lines.length === 0)) && (
        <TitleDisplay label={slide.label} />
      )}
    </div>
  );
}
