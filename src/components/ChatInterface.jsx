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
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Query Result</span>
            <span className="text-[9px] text-zinc-600 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                {data.total_rows} rows found
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
          title="Export CSV"
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
             View Generated SQL
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
            <span className="w-2 h-2 rounded-full bg-indigo-500/50" />
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
                .replace(/\*\*(.*?)\*\*/g, '<b class="text-white font-black">$1</b>')
                .replace(/\*(.*?)\*/g, '<i class="text-indigo-300">$1</i>');

              if (line.trim().match(/^[-*]\s/)) {
                return (
                  <div key={i} className="flex gap-3 pl-2">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500/40 shrink-0" />
                    <span className="text-slate-300" dangerouslySetInnerHTML={{ __html: html.replace(/^[-*]\s/, '') }} />
                  </div>
                );
              }
              return <p key={i} className={role === 'user' ? 'text-white' : 'text-slate-300'} dangerouslySetInnerHTML={{ __html: html }} />;
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
      {role === 'assistant' && isLast && <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />}
      {queryResult && <QueryResultTable data={queryResult} />}
    </>
  );
}


const SUGGESTIONS = [
  'Optimize primary keys for OLAP performance',
  'Add dimension mapping for geographical data',
  'Enforce naming consistency (prefixing)',
  'Verify referential integrity'
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
    { id: 'chat',   label: 'Intelligence', icon: BrainCircuit, color: 'text-indigo-400' },
    { id: 'critic', label: 'Audit',        icon: Shield,       color: 'text-rose-400' },
    { id: 'sql',    label: 'Architecture', icon: Database,     color: 'text-cyan-400' },
    { id: 'etl',    label: 'Pentaho XML',  icon: Code,         color: 'text-emerald-400' },
  ];

  const canChat = pipelineStatus !== 'idle';

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-white/5">
      
      {/* ── Tabs Navigation with Glow ────────────────────────────────────────── */}
      <div className="flex items-center p-2.5 gap-1 border-b border-white/[0.06] bg-black/40 shrink-0">
        {tabs.map(({ id, label, icon: Icon, color }) => {
            const isActive = activeTab === id;
            return (
                <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`relative group flex items-center gap-2 px-3.5 py-2 text-[10.5px] font-black rounded-xl transition-all ${
                        isActive 
                        ? 'bg-white/5 text-white border border-white/10 shadow-lg' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                    }`}
                >
                    <Icon size={13} className={isActive ? color : 'text-slate-600'} />
                    {label.toUpperCase()}
                    {isActive && (
                        <motion.div layoutId="tab-underline" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-500" />
                    )}
                </button>
            )
        })}
      </div>

      {/* ── Content Area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative p-4">
        
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 shadow-2xl relative">
                     <Cpu size={28} className="text-indigo-400" />
                     <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                  </div>
                  <h3 className="text-lg font-black text-white italic tracking-tight mb-2">Neural Architect Copilot</h3>
                  <p className="text-xs text-slate-500 max-w-[240px] leading-relaxed mb-10 uppercase tracking-[0.1em] font-mono">
                    {canChat ? "Pipeline active. Awaiting your strategic directives." : "Initialize a connection to begin modeling."}
                  </p>

                  {canChat && (
                    <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                          className="text-left text-[10.5px] font-bold text-slate-500 px-4 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-indigo-500/10 hover:text-indigo-300 hover:border-indigo-500/30 transition-all group"
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
                    <div className={`w-8 h-8 rounded-xl shrink-0 border flex items-center justify-center shadow-lg ${
                      msg.role === 'user' ? 'bg-slate-800 border-white/10' : 'bg-indigo-600 border-indigo-500 shadow-indigo-500/20'
                    }`}>
                        {msg.role === 'user' ? <Users size={14} /> : <Bot size={14} className="text-white" />}
                    </div>
                    
                    <div className={`relative max-w-[92%] px-5 py-4 rounded-3xl shadow-xl transition-all ${
                      msg.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                      : 'bg-white/[0.03] border border-white/[0.08] text-slate-200 rounded-tl-none backdrop-blur-md'
                    }`}>
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
                            className="w-1.5 h-1.5 bg-indigo-500 rounded-full" 
                          />
                      ))}
                   </div>
                   <span className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.2em] italic">Synthesizing response</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </motion.div>
          )}

          {/* ... Other Tabs Refined Similarly ... */}
          {activeTab === 'critic' && (
            <motion.div key="critic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-4">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                            <Shield size={16} className="text-rose-400" />
                        </div>
                        <h4 className="text-xs font-black text-white italic tracking-widest uppercase underline decoration-rose-500/50 underline-offset-4">Quality Audit Report</h4>
                    </div>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.06] rounded-3xl p-6 italic text-slate-300 shadow-inner">
                    {criticReview ? <FormattedMessage content={criticReview} /> : "Initialization pending. System waiting for model generation."}
                </div>
                
                {criticReview && (
                    <button 
                        onClick={() => sendMessage(`Execute suggested corrections from audit.`, 'sql')}
                        className="w-full py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-black tracking-widest uppercase hover:bg-rose-500/20 transition-all flex items-center justify-center gap-3 shadow-lg"
                    >
                        <RotateCcw size={14} /> Commit Autonomous Patching
                    </button>
                )}
            </motion.div>
          )}

          {activeTab === 'sql' && (
            <motion.div key="sql" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 h-full">
                {sqlDDL ? (
                   <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Validated Logical Schema (DDL)</span>
                            <div className="flex gap-2">
                                <button onClick={() => downloadFile(sqlDDL, 'schema.sql')} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all hover:text-indigo-400" title="Download SQL">
                                    <Download size={14} />
                                </button>
                                <button onClick={() => { navigator.clipboard.writeText(sqlDDL); setCopied('sql'); setTimeout(() => setCopied(null), 2000); }} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all">
                                    {copied === 'sql' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 rounded-3xl overflow-auto custom-scrollbar border border-white/5 bg-black/20 shadow-inner">
                            <SyntaxHighlighter language="sql" style={vscDarkPlus} customStyle={{ margin: 0, padding: '2rem', background: 'transparent', fontSize: '11px', lineHeight: '1.7' }}>
                                {sqlDDL}
                            </SyntaxHighlighter>
                        </div>
                   </div>
                ) : (
                    <div className="h-40 flex items-center justify-center text-slate-800 font-mono text-[9px] uppercase tracking-widest border border-dashed border-white/5 rounded-3xl">No artifact found</div>
                )}
            </motion.div>
          )}
          
          {activeTab === 'etl' && (
            <motion.div key="etl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 h-full">
                {etlCode ? (
                    <div className="h-full flex flex-col">
                         <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Generated Pentaho Transformation (.ktr)</span>
                            <div className="flex gap-2">
                                <button onClick={() => downloadFile(etlCode, 'pipeline.ktr')} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all hover:text-emerald-400" title="Download KTR">
                                    <Download size={14} />
                                </button>
                                <button onClick={() => { navigator.clipboard.writeText(etlCode); setCopied('etl'); setTimeout(() => setCopied(null), 2000); }} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all">
                                    {copied === 'etl' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 rounded-3xl overflow-auto custom-scrollbar border border-white/5 bg-black/20 shadow-inner">
                            <SyntaxHighlighter language="xml" style={vscDarkPlus} customStyle={{ margin: 0, padding: '2rem', background: 'transparent', fontSize: '11px', lineHeight: '1.7' }}>
                                {etlCode}
                            </SyntaxHighlighter>
                        </div>
                    </div>
                ) : (
                    <div className="h-40 flex items-center justify-center text-slate-800 font-mono text-[9px] uppercase tracking-widest border border-dashed border-white/5 rounded-3xl">Integration pending</div>
                )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Conversational Input HUD ────────────────────────────────────────── */}
      <div className="p-6 bg-black/40 border-t border-white/[0.06] backdrop-blur-3xl shrink-0">
        <div className="relative group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all focus-within:border-indigo-500/50 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={!canChat || isSending}
            placeholder={canChat ? "Strategic modification request..." : "Connect source to activate neural interface"}
            rows={1}
            className="w-full bg-transparent text-[13px] font-medium text-slate-200 pl-5 pr-14 py-4 focus:outline-none resize-none placeholder:text-slate-700 min-h-[56px] max-h-[160px]"
            style={{ fieldSizing: 'content' }}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-white/10 hidden lg:flex">
                <Command size={10} className="text-slate-600" />
                <span className="text-[8px] font-black text-slate-600">ENTER</span>
            </div>
            <button
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-30 hover:bg-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] active:scale-95 transition-all shadow-lg"
            >
                {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 px-1">
            <div className="flex items-center gap-3">
                <div className="flex p-0.5 bg-black/40 rounded-lg border border-white/10 shrink-0">
                    <button 
                      onClick={() => setChatMode('architecture')}
                      className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${chatMode === 'architecture' ? 'bg-indigo-600 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                      Modeling
                    </button>
                    <button 
                      disabled={etlStatus !== 'success'}
                      onClick={() => setChatMode('query')}
                      className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${chatMode === 'query' ? 'bg-amber-600 text-white shadow-glow-amber' : 'text-zinc-600 hover:text-zinc-400 disabled:opacity-20'}`}
                      title={etlStatus !== 'success' ? 'Load a warehouse first to query' : 'Query your data'}
                    >
                      Query
                    </button>
                </div>
                <div className="h-4 w-px bg-white/5" />
                <div className="flex items-center gap-2 text-slate-700">
                    <Info size={10} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{chatMode === 'query' ? 'Neural Query Engine Active' : 'Architect Copilot Active'}</span>
                </div>
            </div>
            <div className="text-[9px] font-black text-slate-800 tracking-[0.2em] flex items-center gap-1">
                SYSTEM <span className="text-indigo-400">ENCRYPTED</span>
            </div>
        </div>
      </div>

    </div>
  );
}
