import React from 'react';
import { X, Smartphone, Compass, Eye, Sparkles, Navigation } from 'lucide-react';
import { playClickSound } from '../utils/audioEffects';

interface SensorGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestIosPermission?: () => void;
  needsIosPermission?: boolean;
  isNightVision: boolean;
}

export const SensorGuideModal: React.FC<SensorGuideModalProps> = ({
  isOpen,
  onClose,
  onRequestIosPermission,
  needsIosPermission,
  isNightVision,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="sensor-guide-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div
        id="sensor-guide-modal-content"
        className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-[#08080a] border shadow-2xl overflow-hidden animate-slide-up ${
          isNightVision
            ? 'border-red-900/60 shadow-[0_0_30px_rgba(239,68,68,0.2)] night-vision-filter'
            : 'border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tight">Guia de Sensores & Giroscópio</h2>
          </div>

          <button
            id="btn-close-sensor-guide"
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
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-zinc-300 leading-relaxed">
          {/* Step 1 */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-400 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-zinc-100 font-mono uppercase text-xs mb-1">1. Giroscópio & Bússola Digital</h4>
              <p className="text-zinc-400 text-xs">
                Segure o celular na vertical apontando para a direção do céu desejada. O mapa inferior e a mira superior giram 360° em tempo real acompanhando seus movimentos.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 text-cyan-400 shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-zinc-100 font-mono uppercase text-xs mb-1">2. Mira Inteligente (AstroReticle)</h4>
              <p className="text-zinc-400 text-xs">
                Ao enquadrar uma estrela ou planeta no centro da mira, o AstroVision calcula a posição e acende a identificação do astro com magnitude e distância.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-zinc-100 font-mono uppercase text-xs mb-1">3. Modo Sky Lens com IA</h4>
              <p className="text-zinc-400 text-xs">
                Toque no botão <strong>Sky Lens (Identificar)</strong> para abrir o card de astrofísica do Gemini com mitologia, fatos da NASA e dicas de telescópio.
              </p>
            </div>
          </div>

          {/* iOS permission callout if needed */}
          {needsIosPermission && (
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40">
              <div className="font-bold text-amber-200 mb-1 uppercase font-mono text-xs">Dispositivo iOS Detectado</div>
              <p className="text-amber-300/80 text-xs mb-3">
                No Safari do iPhone, é necessário autorizar o acesso aos sensores de orientação manualmente.
              </p>
              <button
                id="btn-ios-guide-request"
                onClick={onRequestIosPermission}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer shadow-md"
              >
                Autorizar Sensores de Movimento
              </button>
            </div>
          )}

          {/* Fallback tip for PC / desktop */}
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 text-zinc-400 text-[11px]">
            <strong className="text-zinc-200">Dica de uso no Desktop:</strong> Se você estiver em um notebook ou PC sem giroscópio físico, basta arrastar o mouse na tela inferior ou usar o D-Pad virtual para navegar 360° pelo céu!
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-800 bg-[#050505] flex items-center justify-end">
          <button
            id="btn-close-sensor-guide-bottom"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer shadow-md"
          >
            ENTENDIDO
          </button>
        </div>
      </div>
    </div>
  );
};
