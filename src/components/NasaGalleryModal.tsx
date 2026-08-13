import React, { useState, useEffect } from 'react';
import { X, Sparkles, Calendar, User, ExternalLink, Image as ImageIcon, Loader2 } from 'lucide-react';
import { NasaApodData } from '../types/astronomy';
import { playClickSound } from '../utils/audioEffects';

interface NasaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  isNightVision: boolean;
}

export const NasaGalleryModal: React.FC<NasaGalleryModalProps> = ({
  isOpen,
  onClose,
  isNightVision,
}) => {
  const [apodData, setApodData] = useState<NasaApodData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch('/api/nasa/apod')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setApodData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError('Não foi possível carregar o APOD da NASA no momento.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      id="nasa-gallery-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div
        id="nasa-gallery-modal-content"
        className={`w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl bg-[#08080a] border shadow-2xl overflow-hidden animate-slide-up ${
          isNightVision
            ? 'border-red-900/60 shadow-[0_0_30px_rgba(239,68,68,0.2)] night-vision-filter'
            : 'border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-cyan-400 shadow-md">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
                NASA APOD & ESPAÇO PROFUNDO
              </span>
              <h2 className="text-sm font-bold text-zinc-100 uppercase">Foto Astronômica do Dia</h2>
            </div>
          </div>

          <button
            id="btn-close-nasa-gallery"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-zinc-300">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
              <p className="text-zinc-400 font-mono">Carregando imagem de alta resolução da NASA...</p>
            </div>
          ) : error || !apodData ? (
            <div className="py-10 text-center text-zinc-400 font-mono">
              {error || 'Nenhum dado disponível.'}
            </div>
          ) : (
            <>
              {/* Media image */}
              <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-800 bg-black max-h-72">
                <img
                  src={apodData.url}
                  alt={apodData.title}
                  className="w-full h-full object-cover max-h-72"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Title & Metadata */}
              <div>
                <h3 className="text-base font-bold text-zinc-100 mb-1">{apodData.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{apodData.date}</span>
                  </div>
                  {apodData.copyright && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{apodData.copyright}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Explanation */}
              <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-300 leading-relaxed">
                <p>{apodData.explanation}</p>
              </div>

              {apodData.hdurl && (
                <a
                  href={apodData.hdurl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  <span>Ver Imagem Original em HD</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-800 bg-[#050505] flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            Fonte: NASA Astronomy Picture of the Day API
          </span>
          <button
            id="btn-close-nasa-bottom"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-mono font-medium transition cursor-pointer border border-zinc-700"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};
