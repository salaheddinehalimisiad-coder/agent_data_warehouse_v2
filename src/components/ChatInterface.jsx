// src/components/ChatInterface.jsx — Ultimate AI Copilot Interface (V3 Premium)
import { useState, useEffect, useRef } from 'react';
import {
  Send, MessageSquare, Code, Shield,
  Database, Copy, Check, Bot, Loader2, Sparkles,
  Command, Terminal, Cpu, Info, ChevronDown,
  BrainCircuit, RotateCcw, Users, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { usePipelineStore } from '../store/pipelineStore';

// ─── Query Result Table ──────────────────────────────────────────────────────
function QueryResultTable({ data }) {
  if (!data || !data.rows || data.rows.length === 0) return null;
  
  return (
    <div className="mt-4 rounded-2xl border border-white/5 bg-[#0a0a0f] overflow-hidden shadow-2xl">
      <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Résultat de Requête</span>
            <span className="text-[9px] text-zinc-600 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                {data.total_rows} lignes trouvées
            </span>
        </div>
        <button 
          onClick={() => {
            const csv = [
               data.columns.join(','),
               ...data.rows.map(r => data.columns.map(c => `"${r[c]}"`).join(','))
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'query_results.csv';
            a.click();
          }}
          className="p-1 hover:text-white text-zinc-600 transition-colors"
          title="Exporter CSV"
        >
          <Download size={12} />
        </button>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-white/5">
              {data.columns.map(col => (
                <th key={col} className="px-4 py-3 font-black text-zinc-400 border-r border-white/5 uppercase tracking-tighter italic">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                {data.columns.map(col => (
                  <td key={col} className="px-4 py-2.5 text-zinc-300 font-medium whitespace-nowrap border-r border-white/5 last:border-0">
                    {row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.sql && (
        <details className="p-3 bg-black/40 cursor-pointer group">
          <summary className="text-[8px] font-black text-zinc-700 uppercase tracking-widest group-hover:text-zinc-500 transition-colors">
             Voir SQL Généré
          </summary>
          <div className="mt-2 text-[10px] font-mono text-zinc-600 bg-black/60 p-4 rounded-xl border border-white/5 leading-relaxed">
            {data.sql}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Format Code Snippets ───────────────────────────────────────────────────
function MessageCodeBlock({ code, lang }) {
  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-white/5 bg-[#010102]/60 shadow-2xl">
      <div className="bg-white/5 px-4 py-2 text-[9px] text-slate-500 uppercase tracking-widest font-black flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(77,126,247,0.45)' }} />
            <span>{lang || 'Source'}</span>
        </div>
      </div>
      <SyntaxHighlighter
        language={lang || 'sql'} style={vscDarkPlus}
        customStyle={{ margin: 0, padding: '1.25rem', background: 'transparent', fontSize: '12px', lineHeight: '1.6' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function FormattedMessage({ content, role }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="text-[13.5px] leading-[1.65] font-medium tracking-normal space-y-3">
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).split('\n');
          const lang = /^[a-z]+$/i.test(lines[0]?.trim()) ? lines[0].trim() : 'code';
          const code = /^[a-z]+$/i.test(lines[0]?.trim()) ? lines.slice(1).join('\n') : lines.join('\n');
          return <MessageCodeBlock key={idx} code={code} lang={lang} />;
        }
        return (
          <div key={idx} className="space-y-4">
            {part.split('\n').map((line, i) => {
              if (!line.trim()) return <div key={i} className="h-1" />;
              
              const html = line
                .replace(/\*\*(.*?)\*\*/g, '<b class="font-black" style="color:var(--text-primary)">$1</b>')
                .replace(/\*(.*?)\*/g, '<i style="color:var(--blue-200)">$1</i>');

              if (line.trim().match(/^[-*]\s/)) {
                return (
                  <div key={i} className="flex gap-3 pl-2">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'rgba(61,106,232,0.45)' }} />
                    <span className="text-slate-300" dangerouslySetInnerHTML={{ __html: html.replace(/^[-*]\s/, '') }} />
                  </div>
                );
              }
              return <p key={i} className={role === 'user' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'} dangerouslySetInnerHTML={{ __html: html }} />;
            })}
          </div>
        );
      })}
    </div>
  );
}


function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function TypewriterMessage({ content, role, isLast, queryResult }) {
  // Le contenu est maintenant streamé directement par le Zustand Store (pipelineStore)
  // Cela garantit que le Markdown est parsé de manière stable à chaque tick global.
  return (
    <>
      <FormattedMessage content={content} role={role} />
      {role === 'assistant' && isLast && <span className="inline-block w-1.5 h-4 ml-1 animate-pulse align-middle" style={{ background: 'var(--purple-400)' }} />}
      {queryResult && <QueryResultTable data={queryResult} />}
    </>
  );
}


const SUGGESTIONS = [
  'Ajoute une mesure net_amount dans fact_orders',
  'Renomme dim_client en dim_customer',
  'Comment optimiser mes cles primaires OLAP ?',
  'Verifie l\'integrite referentielle de mon schema',
];

export default function ChatInterface() {
  const { messages, sqlDDL, etlCode, criticReview, sendMessage, pipelineStatus, etlStatus } = usePipelineStore();
  const [input, setInput]         = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [isSending, setIsSending] = useState(false);
  const [chatMode, setChatMode]   = useState('architecture'); // 'architecture' | 'query'
  const [copied, setCopied]       = useState(null);
  const messagesEndRef             = useRef(null);
  const textareaRef                = useRef(null);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isSending) return;
    const msg = input.trim();
    setInput('');
    setIsSending(true);
    await sendMessage(msg, activeTab === 'etl' ? 'etl' : 'sql', chatMode);
    setIsSending(false);
  };


  const tabs = [
    { id: 'chat',   label: 'Intelligence', icon: BrainCircuit, color: 'text-purple-400' },
    { id: 'critic', label: 'Audit',        icon: Shield,       color: 'text-rose-400' },
    { id: 'sql',    label: 'Architecture', icon: Database,     color: 'text-cobalt-300' },
    { id: 'etl',    label: 'Pentaho XML',  icon: Code,         color: 'text-emerald-400' },
  ];

  const canChat = pipelineStatus !== 'idle';

  return (
    <div className="flex flex-col h-full bg-transparent">

      {/* ── Content Area (chat uniquement, plus d'onglets) ─────────────────── */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar relative p-4"
        role="log"
        aria-label="Conversation avec Atlas"
        aria-live="polite"
        aria-atomic="false"
      >

        <AnimatePresence mode="wait">
          {true && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-2xl relative" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                     <Cpu size={28} style={{ color: 'var(--purple-400)' }} />
                     <div className="absolute inset-0 blur-2xl rounded-full" style={{ background: 'rgba(139,92,246,0.15)' }} />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight mb-1">Bonjour, je suis Atlas</h3>
                  <p className="text-[11px] text-slate-500 max-w-[260px] leading-relaxed mb-8 font-medium">
                    {canChat
                      ? "Architecte ETL & Data Warehouse. Pose-moi une question, decris une modification, ou demande-moi d'analyser ton schema."
                      : "Connecte une source de donnees pour commencer."}
                  </p>

                  {canChat && (
                    <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                          className="text-left text-[10.5px] font-bold text-slate-500 px-4 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-cobalt-500/10 hover:text-cobalt-300 hover:border-cobalt-500/30 transition-all group"
                        >
                          <span className="mr-2 opacity-50 group-hover:opacity-100">/</span> {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className="w-8 h-8 rounded-xl shrink-0 border flex items-center justify-center shadow-lg"
                      style={msg.role === 'user'
                        ? { background: 'var(--bg-higher)', borderColor: 'var(--border-soft)' }
                        : { background: 'rgba(139,92,246,0.2)', borderColor: 'rgba(139,92,246,0.35)' }
                      }
                    >
                        {msg.role === 'user' ? <Users size={14} /> : <Bot size={14} className="text-white" />}
                    </div>
                    
                    <div
                      className="relative max-w-[92%] px-5 py-4 shadow-xl transition-all"
                      style={msg.role === 'user' ? {
                        background: 'var(--grad-ai)', color: 'white',
                        borderRadius: '20px 4px 20px 20px',
                      } : {
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--text-secondary)',
                        borderRadius: '4px 20px 20px 20px',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                        <TypewriterMessage
                          content={msg.content}
                          role={msg.role}
                          isLast={idx === messages.length - 1}
                          queryResult={msg.queryResult}
                        />
                    </div>

                  </motion.div>
                ))
              )}
              {isSending && (
                <div className="flex items-center gap-3 px-12">
                   <div className="flex gap-1.5">
                      {[1,2,3].map(i => (
                          <motion.div 
                            key={i} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: i*0.1 }}
                            style={{ background: 'var(--purple-400)' }} className="w-1.5 h-1.5 rounded-full"
                          />
                      ))}
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] italic" style={{ color: 'var(--purple-400)', opacity: 0.7 }}>Synthesizing response</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Composer (zone de saisie redesignee) ─────────────────────────────── */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        <div
          className="relative rounded-2xl transition-all"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
          onFocusCapture={e => {
            e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)';
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(139,92,246,0.15), 0 0 0 4px rgba(139,92,246,0.08)';
          }}
          onBlurCapture={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)';
          }}
        >
          {/* Glow subtil au focus (decoratif) */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(139,92,246,0.12), transparent 70%)' }}
          />

          <label htmlFor="atlas-input" className="sr-only">
            Message pour Atlas
          </label>
          <textarea
            id="atlas-input"
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={!canChat || isSending}
            placeholder={canChat ? "Demande a Atlas... (ex: ajoute net_amount dans fact_orders)" : "Connecte une source pour activer Atlas"}
            rows={1}
            aria-label="Saisir votre demande pour Atlas"
            aria-describedby="atlas-input-hint"
            aria-disabled={!canChat || isSending}
            className="w-full bg-transparent text-[13.5px] leading-[1.55] font-medium text-slate-100 pl-4 pr-16 pt-3.5 pb-12 focus:outline-none resize-none placeholder:text-slate-600 min-h-[88px] max-h-[200px]"
            style={{ fieldSizing: 'content' }}
          />

          {/* Barre du bas : raccourci a gauche + bouton envoi a droite */}
          <div className="absolute left-3 right-3 bottom-2.5 flex items-center justify-between pointer-events-none">
            <span id="atlas-input-hint" className="text-[9px] font-medium text-slate-600 tracking-wider flex items-center gap-1.5 pointer-events-auto select-none">
              <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[8.5px] text-slate-500 font-mono">Entree</kbd>
              <span>pour envoyer</span>
              <span className="text-slate-700">·</span>
              <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[8.5px] text-slate-500 font-mono">Maj+Entree</kbd>
              <span>pour saut de ligne</span>
            </span>

            <motion.button
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              whileHover={input.trim() && !isSending ? { scale: 1.06 } : {}}
              whileTap={input.trim() && !isSending ? { scale: 0.94 } : {}}
              className="pointer-events-auto relative w-9 h-9 rounded-xl text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              style={{
                background: input.trim() && !isSending
                  ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)'
                  : 'rgba(255,255,255,0.06)',
                boxShadow: input.trim() && !isSending
                  ? '0 4px 16px rgba(139,92,246,0.4), 0 0 0 1px rgba(255,255,255,0.06) inset'
                  : 'none',
              }}
              aria-label="Envoyer le message"
            >
              {isSending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={14} strokeWidth={2.4} style={{ transform: 'translate(0.5px, -0.5px)' }} />
              )}
            </motion.button>
          </div>
        </div>
      </div>

    </div>
  );
}
