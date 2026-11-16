import { useEffect, useRef, useState } from 'react';

export default function ImageViewer({ src, alt, onClose }) {
  const [zoom, setZoom] = useState(1);
  const backdropRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [onClose]);

  function changeZoom(amount) {
    setZoom(current => Math.min(4, Math.max(1, current + amount)));
  }

  useEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop) return undefined;

    function handleWheel(event) {
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? 0.2 : -0.2);
    }

    backdrop.addEventListener('wheel', handleWheel, { passive: false });
    return () => backdrop.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div
      ref={backdropRef}
      className="image-viewer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Imagem ampliada: ${alt}`}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button className="image-viewer-close" type="button" onClick={onClose} aria-label="Fechar imagem">
        ×
      </button>
      <div className="image-viewer-content">
        <div className="image-viewer-stage">
          <img
            src={src}
            alt={alt}
            draggable="false"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>
        <div className="image-viewer-controls">
          <button type="button" onClick={() => changeZoom(-0.2)} disabled={zoom <= 1} aria-label="Diminuir zoom">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(0.2)} disabled={zoom >= 4} aria-label="Aumentar zoom">+</button>
          <small>Use a roda do mouse para ampliar</small>
        </div>
      </div>
    </div>
  );
}
