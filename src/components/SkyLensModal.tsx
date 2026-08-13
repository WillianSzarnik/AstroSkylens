import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Compass,
  Telescope,
  BookOpen,
  HelpCircle,
  Send,
  Loader2,
  ExternalLink,
  Award,
  Zap,
} from 'lucide-react';
import { CelestialObject, SkyLensResult } from '../types/astronomy';
import { playClickSound } from '../utils/audioEffects';

interface SkyLensModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: SkyLensResult | null;
  targetObject: CelestialObject | null;
  snapshotUrl: string | null;
  isLoading: boolean;
  isNightVision: boolean;
  onAskFollowup: (question: string) => Promise<string | null>;
}

export const SkyLensModal: React.FC<SkyLensModalProps> = ({
  isOpen,
  onClose,
  result,
  targetObject,
  snapshotUrl,
  isLoading,
  isNightVision,
  onAskFollowup,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'astrophysics' | 'mythology' | 'chat'>('info');
  const [userQuery, setUserQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'ai'; text: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  if (!isOpen) return null;

  const handleSendQuestion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userQuery.trim() || isAsking) return;

    const query = userQuery.trim();
    setUserQuery('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setIsAsking(true);

    try {
      const response = await onAskFollowup(query);
      if (response) {
        setChatMessages((prev) => [...prev, { sender: 'ai', text: response }]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'Desculpe, ocorreu uma instabilidade ao consultar o Gemini. Tente novamente.' },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const name = result?.name || targetObject?.name || 'Astro Identificado';
  const scientificName = result?.scientificName || targetObject?.scientificName || 'Objeto Celeste';
  const type = result?.type || targetObject?.type || 'star';
  const constellation = result?.constellation || targetObject?.constellation || 'Abóbada Celeste';
  const magnitude = result?.apparentMagnitude || (targetObject?.mag != null ? String(targetObject.mag) : 'N/A');
  const distance = result?.distance || targetObject?.distance || 'Anos-luz';
  const summary = result?.shortSummary || targetObject?.description || 'Corpo celeste observado na direção apontada.';

  return (
    <div
      id="sky-lens-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div
        id="sky-lens-modal-content"
        className={`w-full max-w-lg max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#08080a] border shadow-2xl overflow-hidden animate-slide-up ${
          isNightVision
            ? 'border-red-900/60 shadow-[0_0_30px_rgba(239,68,68,0.2)] night-vision-filter'
            : 'border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Modal Header */}
        <div className="relative px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-cyan-400 shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
                  GOOGLE LENS / ASTROVISION
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
                  GEMINI AI
                </span>
              </div>
              <h2 className="text-base font-bold text-zinc-100">{name}</h2>
            </div>
          </div>

          <button
            id="btn-close-sky-lens"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading Spinner State */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-zinc-700 border-b-zinc-400 animate-spin-reverse" />
              <div className="absolute inset-0 flex items-center justify-center text-cyan-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
            </div>
            <h3 className="text-sm font-bold tracking-tight text-zinc-100 uppercase mb-1">
              Escaneando Abóbada Celeste com Gemini...
            </h3>
            <p className="text-xs text-zinc-400 max-w-xs">
              Cruzando dados espectrais, efemérides da NASA e posição angular da câmera para identificação precisa.
            </p>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex border-b border-zinc-800 bg-[#050505] px-2">
              <button
                id="tab-sky-lens-info"
                onClick={() => {
                  playClickSound();
                  setActiveTab('info');
                }}
                className={`flex-1 py-2.5 text-xs font-mono tracking-wider border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'info'
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Telescope className="w-3.5 h-3.5" />
                GERAL
              </button>
              <button
                id="tab-sky-lens-astrophysics"
                onClick={() => {
                  playClickSound();
                  setActiveTab('astrophysics');
                }}
                className={`flex-1 py-2.5 text-xs font-mono tracking-wider border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'astrophysics'
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                ASTROFÍSICA
              </button>
              <button
                id="tab-sky-lens-mythology"
                onClick={() => {
                  playClickSound();
                  setActiveTab('mythology');
                }}
                className={`flex-1 py-2.5 text-xs font-mono tracking-wider border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'mythology'
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                HISTÓRIA
              </button>
              <button
                id="tab-sky-lens-chat"
                onClick={() => {
                  playClickSound();
                  setActiveTab('chat');
                }}
                className={`flex-1 py-2.5 text-xs font-mono tracking-wider border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'chat'
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                PERGUNTAR IA
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-zinc-300 text-xs leading-relaxed">
              {/* TAB 1: General Info */}
              {activeTab === 'info' && (
                <div className="space-y-4">
                  {/* Photo or Visual Banner */}
                  {snapshotUrl && (
                    <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-zinc-800 bg-black">
                      <img
                        src={snapshotUrl}
                        alt="Captura do céu"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-2 left-2 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-lg text-[10px] text-zinc-300 border border-zinc-700 flex items-center gap-1.5 font-mono">
                        <Compass className="w-3 h-3 text-cyan-400" />
                        <span>CAPTURA DA CÂMERA</span>
                      </div>
                    </div>
                  )}

                  {/* Summary Card */}
                  <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <p className="text-zinc-200 leading-normal text-xs">{summary}</p>
                  </div>

                  {/* Quick Specs Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                      <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Constelação</div>
                      <div className="font-semibold text-zinc-100 truncate">{constellation}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                      <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Magnitude Aparente</div>
                      <div className="font-semibold text-cyan-400 font-mono">{magnitude}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                      <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Distância da Terra</div>
                      <div className="font-semibold text-zinc-100 truncate">{distance}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                      <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Catálogo / Espectro</div>
                      <div className="font-semibold text-zinc-200 truncate font-mono">
                        {result?.spectralClassOrComposition || scientificName}
                      </div>
                    </div>
                  </div>

                  {/* Observation Tips */}
                  {(result?.observationTips || targetObject?.tips) && (
                    <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-cyan-500/30 flex items-start gap-2.5">
                      <Telescope className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-zinc-100 mb-0.5 uppercase font-mono text-[11px] tracking-wider">Dicas de Observação</div>
                        <p className="text-zinc-300 text-xs">
                          {result?.observationTips || targetObject?.tips}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Curiosity */}
                  {result?.curiosity && (
                    <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-amber-500/30 flex items-start gap-2.5">
                      <Award className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-zinc-100 mb-0.5 uppercase font-mono text-[11px] tracking-wider">Você Sabia?</div>
                        <p className="text-zinc-300 text-xs">{result.curiosity}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Astrophysics Facts */}
              {activeTab === 'astrophysics' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-zinc-100 uppercase font-mono text-xs tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    Fatos Astrofísicos & Descobertas
                  </h4>
                  <div className="space-y-2.5">
                    {(result?.astrophysicsFacts || targetObject?.facts || []).map((fact, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-start gap-2.5"
                      >
                        <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center shrink-0 text-[10px] font-mono font-bold">
                          {idx + 1}
                        </span>
                        <p className="text-zinc-200 leading-normal">{fact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: History & Mythology */}
              {activeTab === 'mythology' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-zinc-100 uppercase font-mono text-xs tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    Mitologia & História Cultural
                  </h4>
                  <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2.5">
                    <p className="text-zinc-200 leading-relaxed text-xs">
                      {result?.mythologyAndHistory ||
                        targetObject?.mythology ||
                        'Registros astronômicos desta constelação datam de civilizações babilônicas, gregas, chinesas e tradições indígenas das Américas.'}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: Ask Gemini AI */}
              {activeTab === 'chat' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-300 text-xs">
                    Faça qualquer pergunta sobre <strong className="text-cyan-400">{name}</strong> ou sobre o que você está observando no céu. O Gemini responderá com dados astronômicos em tempo real.
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-6 text-zinc-500 text-xs font-mono">
                        Nenhuma pergunta enviada ainda. Tente: <em>"A que distância está da Terra?"</em> ou <em>"Ela tem planetas ao redor?"</em>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-2xl text-xs ${
                            msg.sender === 'user'
                              ? 'bg-cyan-950/50 border border-cyan-700/50 text-cyan-100 ml-6'
                              : 'bg-zinc-900/80 border border-zinc-800 text-zinc-200 mr-6'
                          }`}
                        >
                          <div className="text-[9px] font-mono mb-1 text-zinc-400 uppercase tracking-wider">
                            {msg.sender === 'user' ? 'Você' : 'AstroLens AI'}
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      ))
                    )}
                    {isAsking && (
                      <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-zinc-400 text-xs flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>AstroLens está pesquisando no cosmos...</span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendQuestion} className="flex gap-2 pt-2">
                    <input
                      id="input-gemini-sky-question"
                      type="text"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder={`Pergunte algo sobre ${name}...`}
                      className="flex-1 px-3 py-2 bg-[#050505] border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-400 font-sans"
                    />
                    <button
                      id="btn-send-gemini-sky-question"
                      type="submit"
                      disabled={isAsking || !userQuery.trim()}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center shadow-md"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-zinc-800 bg-[#050505] flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            AstroVision &bull; Dados NASA & Gemini AI
          </span>
          <button
            id="btn-modal-done"
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
