import { useEffect, useRef, useState } from 'react';

export default function ImageViewer({ images, onClose }) {
  const [zooms, setZooms] = useState(() => images.map(() => 1));
  const backdropRef = useRef(null);

  function changeZoom(index, amount) {
    setZooms(current => current.map((zoom, imageIndex) => (
      imageIndex === index ? Math.min(4, Math.max(1, zoom + amount)) : zoom
    )));
  }

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

  useEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop) return undefined;

    function handleWheel(event) {
      event.preventDefault();
      const stage = event.target.closest('.image-viewer-stage');
      if (!stage) return;
      const index = Number(stage.dataset.imageIndex);
      changeZoom(index, event.deltaY < 0 ? 0.2 : -0.2);
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
      aria-label={`Imagens ampliadas: ${images.map(image => image.alt).join(', ')}`}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button className="image-viewer-close" type="button" onClick={onClose} aria-label="Fechar imagens">
        ×
      </button>
      <div className="image-viewer-content">
        <div className={`image-viewer-grid${images.length === 1 ? ' single' : ''}`}>
          {images.map((image, index) => {
            const zoom = zooms[index] || 1;
            return (
              <section className="image-viewer-item" key={`${image.src}-${index}`}>
                <h2 className="image-viewer-label">{image.label}</h2>
                <div className="image-viewer-stage" data-image-index={index}>
                  <img
                    src={image.src}
                    alt={image.alt}
                    draggable="false"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
                <div className="image-viewer-controls">
                  <button
                    type="button"
                    onClick={() => changeZoom(index, -0.2)}
                    disabled={zoom <= 1}
                    aria-label={`Diminuir zoom da ${image.label.toLocaleLowerCase('pt-BR')}`}
                  >
                    −
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => changeZoom(index, 0.2)}
                    disabled={zoom >= 4}
                    aria-label={`Aumentar zoom da ${image.label.toLocaleLowerCase('pt-BR')}`}
                  >
                    +
                  </button>
                  <small>Use a roda do mouse para ampliar</small>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
