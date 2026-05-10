// src/components/ChatInterface.jsx
// Atlas — Assistant conversationnel.
// Design minimaliste inspiré de Claude.ai / Cursor / Linear :
//   • Empty state hero : grand logo, salutation, suggestions ghost
//   • Messages : utilisateur en bulle violet pâle, assistant en prose fluide sans bulle
//   • Composer flottant en îlot, hints/compteur fugitifs
//   • Sidebar épurée, hover-only actions
//   • Palette ardoise quasi-noire, accents violet utilisés avec parcimonie
//   • Markdown léger : code blocks (avec copy + langage), listes, gras, italique, liens, h1-h3
//   • Brouillon auto-sauvegardé, abort, raccourcis clavier
//   • Accessibilité : ARIA roles, labels, live regions
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Send, Square, Copy, Check, Sparkles, Plus, Search,
  RotateCcw, ThumbsUp, ThumbsDown, Trash2, Download,
  ChevronDown, MessageSquare, X, Wifi, WifiOff,
  Pencil, Pin, Edit3, MoreHorizontal, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { usePipelineStore } from '../store/pipelineStore';

// ─── Constantes & utilitaires ─────────────────────────────────────────────
const MAX_INPUT_CHARS = 4000;
const STORAGE_CONVS   = 'atlas:conversations:v2';
const STORAGE_DRAFT   = 'atlas:draft:v1';
const STORAGE_ACTIVE  = 'atlas:active-conv:v1';

const STARTERS = [
  'Ajoute une mesure à fact_sales',
  'Audit de qualité du schéma',
  'Compare le CA 2024 vs 2023',
  'Génère 5 KPI pour la direction',
];

const uid = () => `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const formatTime = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const formatRelative = (ts) => {
  const diff = Date.now() - ts;
  if (diff < 60_000)        return 'À l’instant';
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)} h`;
  if (diff < 604_800_000)   return `${Math.floor(diff / 86_400_000)} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const safeReadLS = (key, fallback) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
};
const safeWriteLS = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota / private */ }
};

const titleFromMessage = (text) => {
  const cleaned = (text || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Nouvelle conversation';
  return cleaned.slice(0, 56) + (cleaned.length > 56 ? '…' : '');
};

// ─── Hook : conversations persistées ──────────────────────────────────────
function useConversations() {
  const [conversations, setConversations] = useState(() => safeReadLS(STORAGE_CONVS, []));
  const [activeId, setActiveId]           = useState(() => safeReadLS(STORAGE_ACTIVE, null));

  useEffect(() => safeWriteLS(STORAGE_CONVS, conversations), [conversations]);
  useEffect(() => safeWriteLS(STORAGE_ACTIVE, activeId), [activeId]);

  const createConv = useCallback(() => {
    const conv = {
      id: uid(),
      title: 'Nouvelle conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      messageCount: 0,
    };
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
    return conv.id;
  }, []);

  const updateConv = useCallback((id, patch) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c));
  }, []);

  const removeConv = useCallback((id) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    setActiveId(prev => prev === id ? null : prev);
  }, []);

  const togglePin  = useCallback((id) => setConversations(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c)), []);
  const renameConv = useCallback((id, title) => setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c)), []);

  return { conversations, activeId, setActiveId, createConv, updateConv, removeConv, togglePin, renameConv };
}

// ─── Code block avec bouton copy ──────────────────────────────────────────
function CodeBlock({ code, lang = 'sql' }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => navigator.clipboard.writeText(code).then(() => {
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  });
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/[0.08] bg-[#141420]">
      <div className="flex items-center justify-between px-3 h-7 bg-white/[0.025]">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em]">{lang}</span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-200 transition-colors"
          aria-label="Copier le code"
        >
          {copied ? <Check size={10.5} /> : <Copy size={10.5} />}
          <span className="hidden sm:inline">{copied ? 'Copié' : 'Copier'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={vscDarkPlus}
        customStyle={{
          margin: 0, padding: '0.95rem 1rem', background: 'transparent',
          fontSize: '12.5px', lineHeight: '1.7',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// ─── Markdown léger ───────────────────────────────────────────────────────
function MarkdownContent({ content }) {
  const parts = useMemo(() => {
    const out = [];
    const re = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;
    let lastIdx = 0, m;
    while ((m = re.exec(content)) !== null) {
      if (m.index > lastIdx) out.push({ type: 'prose', text: content.slice(lastIdx, m.index) });
      out.push({ type: 'code', lang: m[1] || 'plaintext', code: m[2] });
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < content.length) out.push({ type: 'prose', text: content.slice(lastIdx) });
    return out;
  }, [content]);

  const renderInline = (text) => {
    const html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/`([^`]+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/[0.06] text-violet-200 font-mono text-[12.5px]">$1</code>')
      .replace(/\*\*([^*]+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      .replace(/(?:^|\s)\*([^*\n]+?)\*(?=\s|$)/g, ' <em class="text-zinc-200 italic">$1</em>')
      .replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline" href="$2" target="_blank" rel="noopener">$1</a>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const renderProse = (text) => {
    const lines = text.split('\n');
    const blocks = [];
    let listBuffer = null;

    const flushList = () => {
      if (!listBuffer) return;
      const Tag = listBuffer.type;
      blocks.push(
        <Tag key={`list-${blocks.length}`} className={`my-2 ${listBuffer.type === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-1.5 marker:text-zinc-400`}>
          {listBuffer.items.map((it, i) => <li key={i} className="text-zinc-100 leading-[1.7]">{renderInline(it)}</li>)}
        </Tag>
      );
      listBuffer = null;
    };

    lines.forEach((raw, i) => {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) { flushList(); return; }
      if (/^### /.test(line))      { flushList(); blocks.push(<h3 key={i} className="mt-4 mb-1.5 text-[15px] font-semibold text-white">{renderInline(line.slice(4))}</h3>); return; }
      if (/^## /.test(line))       { flushList(); blocks.push(<h2 key={i} className="mt-4 mb-2 text-[16.5px] font-semibold text-white">{renderInline(line.slice(3))}</h2>); return; }
      if (/^# /.test(line))        { flushList(); blocks.push(<h1 key={i} className="mt-4 mb-2 text-[18px] font-semibold text-white">{renderInline(line.slice(2))}</h1>); return; }
      const ulMatch = line.match(/^\s*[-*•]\s+(.*)$/);
      const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      if (ulMatch) { if (!listBuffer || listBuffer.type !== 'ul') { flushList(); listBuffer = { type: 'ul', items: [] }; } listBuffer.items.push(ulMatch[1]); return; }
      if (olMatch) { if (!listBuffer || listBuffer.type !== 'ol') { flushList(); listBuffer = { type: 'ol', items: [] }; } listBuffer.items.push(olMatch[1]); return; }
      flushList();
      if (/^>\s/.test(line)) {
        blocks.push(<blockquote key={i} className="my-2 pl-3 border-l-2 border-violet-500/35 text-zinc-300 italic">{renderInline(line.slice(2))}</blockquote>);
        return;
      }
      blocks.push(<p key={i} className="text-zinc-100 leading-[1.75]">{renderInline(line)}</p>);
    });
    flushList();
    return <div className="space-y-2">{blocks}</div>;
  };

  return (
    <div className="text-[14.5px] text-zinc-100">
      {parts.map((p, i) => p.type === 'code'
        ? <CodeBlock key={i} code={p.code} lang={p.lang} />
        : <div key={i}>{renderProse(p.text)}</div>
      )}
    </div>
  );
}

// ─── Logo Atlas (gradient badge) ──────────────────────────────────────────
function AtlasMark({ size = 28 }) {
  return (
    <div
      className="rounded-[10px] flex items-center justify-center shrink-0"
      style={{
        width: size, height: size,
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)',
        boxShadow: '0 4px 12px rgba(139,92,246,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
    >
      <img src="/atlas.png" alt="Atlas" style={{ width: size * 0.55, height: size * 0.55, borderRadius: 4, objectFit: 'cover' }} />
    </div>
  );
}

// ─── Bulle utilisateur ─────────────────────────────────────────────────────
function UserMessage({ msg, onEdit }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => navigator.clipboard.writeText(msg.content || '').then(() => {
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  });
  return (
    <div className="group flex justify-end gap-2 pl-12">
      <div className="flex flex-col items-end max-w-[85%]">
        <div className="px-4 py-2.5 rounded-2xl rounded-tr-md text-zinc-50 text-[14.5px] leading-[1.6] whitespace-pre-wrap break-words"
             style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(99,102,241,0.18))', border: '1px solid rgba(139,92,246,0.22)' }}>
          {msg.content}
        </div>
        <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onCopy} className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]" aria-label="Copier">
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          </button>
          {onEdit && (
            <button onClick={() => onEdit(msg)} className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]" aria-label="Modifier" title="Modifier">
              <Pencil size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bulle assistant (style Claude/ChatGPT — pas de bubble) ───────────────
function AssistantMessage({ msg, isLast, isStreaming, onRegenerate, onFeedback }) {
  const [copied, setCopied]     = useState(false);
  const [feedback, setFeedback] = useState(null);

  const onCopy = () => navigator.clipboard.writeText(msg.content || '').then(() => {
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  });
  const sendFeedback = (kind) => { setFeedback(kind); onFeedback?.(msg, kind); };

  return (
    <div className="group flex gap-3.5">
      <AtlasMark size={28} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="break-words">
          <MarkdownContent content={msg.content || ''} />
          {isStreaming && isLast && (
            <span className="inline-block w-[6px] h-[14px] ml-0.5 align-middle bg-violet-400 animate-pulse rounded-sm" aria-hidden="true" />
          )}
        </div>
        {/* Actions sous le message */}
        <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onCopy} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]" aria-label="Copier la réponse">
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
          {onRegenerate && (
            <button onClick={() => onRegenerate(msg)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]" aria-label="Régénérer" title="Régénérer">
              <RotateCcw size={12} />
            </button>
          )}
          <button
            onClick={() => sendFeedback('up')}
            className={`p-1.5 rounded hover:bg-white/[0.05] ${feedback === 'up' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-200'}`}
            aria-label="Réponse utile"
          >
            <ThumbsUp size={12} />
          </button>
          <button
            onClick={() => sendFeedback('down')}
            className={`p-1.5 rounded hover:bg-white/[0.05] ${feedback === 'down' ? 'text-rose-400' : 'text-zinc-500 hover:text-zinc-200'}`}
            aria-label="Réponse pas utile"
          >
            <ThumbsDown size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state hero ─────────────────────────────────────────────────────
function EmptyHero({ canChat, onPick }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      {/* Logo avec halo */}
      <div className="relative mb-6">
        <div className="absolute inset-0 blur-[40px] rounded-full bg-violet-500/40" />
        <div className="relative">
          <AtlasMark size={56} />
        </div>
      </div>

      <h1 className="text-[26px] sm:text-[28px] font-semibold text-zinc-50 tracking-tight mb-1.5">
        Comment puis-je vous aider ?
      </h1>
      <p className="text-[13.5px] text-zinc-500 mb-9 text-center max-w-md">
        {canChat
          ? 'Architecte ETL et Data Warehouse à votre disposition.'
          : 'Connectez une source pour démarrer.'}
      </p>

      {canChat && (
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
          {STARTERS.map((s, i) => (
            <button
              key={i}
              onClick={() => onPick(s)}
              className="px-3.5 py-2 rounded-full text-[12.5px] text-zinc-300 hover:text-white border border-white/[0.06] hover:border-white/[0.14] bg-white/[0.02] hover:bg-white/[0.04] transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────
function Sidebar({
  conversations, activeId, onSelect, onCreate, onDelete, onRename, onTogglePin,
  collapsed, onToggleCollapsed, onExport,
}) {
  const [query, setQuery]           = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = conversations;
    if (q) list = list.filter(c => (c.title || '').toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }, [conversations, query]);

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 border-r border-white/[0.04] bg-[#0a0a0e] flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapsed}
          className="p-2 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
          aria-label="Ouvrir l'historique" title="Historique"
        >
          <PanelLeftOpen size={15} />
        </button>
        <button
          onClick={onCreate}
          className="p-2 rounded-md text-zinc-300 hover:text-white hover:bg-white/[0.06]"
          aria-label="Nouvelle conversation" title="Nouvelle conversation"
        >
          <Plus size={15} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[252px] shrink-0 border-r border-white/[0.04] bg-[#0a0a0e] flex flex-col">
      {/* Header sidebar */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-1.5">
        <button
          onClick={onCreate}
          className="flex-1 flex items-center gap-2 px-3 h-8 rounded-md text-zinc-200 hover:text-white text-[12.5px] font-medium border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
        >
          <Plus size={13} />
          Nouvelle conversation
        </button>
        <button
          onClick={onToggleCollapsed}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
          aria-label="Réduire" title="Réduire"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* Recherche (apparaît seulement s'il y a au moins quelques conversations) */}
      {conversations.length > 3 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher"
              className="w-full pl-7 pr-2 h-7 text-[12px] rounded-md bg-white/[0.02] border border-white/[0.04] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.12] focus:bg-white/[0.04] transition-colors"
            />
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-1.5 pb-2 space-y-px">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[11.5px] text-zinc-600">
            {query ? 'Aucun résultat' : 'Aucune conversation'}
          </div>
        ) : (
          filtered.map((c) => {
            const isActive    = c.id === activeId;
            const isRenaming  = renamingId === c.id;
            return (
              <div
                key={c.id}
                onClick={() => !isRenaming && onSelect(c.id)}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                {c.pinned && <Pin size={9} className="text-amber-400 shrink-0" />}
                {isRenaming ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => { onRename(c.id, renameValue.trim() || c.title); setRenamingId(null); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')  { onRename(c.id, renameValue.trim() || c.title); setRenamingId(null); }
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="flex-1 min-w-0 bg-transparent border-b border-violet-500/40 px-0 text-[12.5px] text-zinc-100 focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={`flex-1 min-w-0 truncate text-[12.5px] ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`}>
                    {c.title}
                  </span>
                )}

                {/* Actions au survol */}
                {!isRenaming && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onTogglePin(c.id); }}
                      className="p-1 rounded text-zinc-500 hover:text-amber-400"
                      title="Épingler"
                    >
                      <Pin size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.title); }}
                      className="p-1 rounded text-zinc-500 hover:text-zinc-200"
                      title="Renommer"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer cette conversation ?')) onDelete(c.id); }}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400"
                      title="Supprimer"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pied : export */}
      <div className="border-t border-white/[0.04] px-3 py-2 flex items-center justify-between">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 text-[10.5px] text-zinc-500 hover:text-zinc-200 transition-colors"
          title="Exporter l'historique"
        >
          <Download size={10.5} />
          Exporter
        </button>
        <span className="text-[10px] text-zinc-600 tabular-nums">{conversations.length}</span>
      </div>
    </aside>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────
export default function ChatInterface({ embedded = false }) {
  const { messages, sendMessage, pipelineStatus } = usePipelineStore();
  const { conversations, activeId, setActiveId, createConv, updateConv, removeConv, togglePin, renameConv } = useConversations();

  const [input, setInput]                       = useState(() => safeReadLS(STORAGE_DRAFT, ''));
  const [isSending, setIsSending]               = useState(false);
  const [editingId, setEditingId]               = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(embedded);
  const [autoScroll, setAutoScroll]             = useState(true);
  const [showScrollBtn, setShowScrollBtn]       = useState(false);
  const [networkOnline, setNetworkOnline]       = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [errorBanner, setErrorBanner]           = useState(null);
  const [showHints, setShowHints]               = useState(false);

  const messagesEndRef     = useRef(null);
  const messagesScrollRef  = useRef(null);
  const textareaRef        = useRef(null);
  const abortControllerRef = useRef(null);
  const previousMsgCountRef = useRef(messages.length);

  const canChat   = pipelineStatus !== 'idle';
  const activeConv = conversations.find(c => c.id === activeId);

  // Brouillon
  useEffect(() => {
    const t = setTimeout(() => safeWriteLS(STORAGE_DRAFT, input), 300);
    return () => clearTimeout(t);
  }, [input]);

  // Réseau
  useEffect(() => {
    const onOnline  = () => { setNetworkOnline(true);  setErrorBanner(null); };
    const onOffline = () => { setNetworkOnline(false); setErrorBanner('Connexion perdue.'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // Auto-scroll intelligent
  useEffect(() => {
    const newCount = messages.length;
    const grew = newCount > previousMsgCountRef.current;
    previousMsgCountRef.current = newCount;
    if (grew && autoScroll) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, autoScroll]);

  useEffect(() => {
    if (!isSending || !autoScroll) return;
    const id = setInterval(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 250);
    return () => clearInterval(id);
  }, [isSending, autoScroll]);

  const handleScroll = () => {
    const el = messagesScrollRef.current; if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 80;
    setAutoScroll(atBottom);
    setShowScrollBtn(!atBottom && messages.length > 0);
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  // Raccourcis
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === 'k') { e.preventDefault(); handleNewConversation(); }
      if (meta && e.key === '/') { e.preventDefault(); textareaRef.current?.focus(); }
      if (e.key === 'Escape' && isSending) { e.preventDefault(); handleStop(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSending]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current; if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
  }, [input]);

  // Hints fugitifs : visible 3s au focus, puis disparaissent
  useEffect(() => {
    if (!showHints) return;
    const t = setTimeout(() => setShowHints(false), 3000);
    return () => clearTimeout(t);
  }, [showHints]);

  // Actions
  const handleNewConversation = () => {
    const id = createConv();
    setInput(''); setEditingId(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
    return id;
  };

  const handleSend = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || isSending) return;
    if (text.length > MAX_INPUT_CHARS) {
      setErrorBanner(`Message trop long (${text.length}/${MAX_INPUT_CHARS}).`);
      return;
    }

    let convId = activeId;
    if (!convId) convId = handleNewConversation();

    setInput(''); safeWriteLS(STORAGE_DRAFT, '');
    setEditingId(null); setIsSending(true); setErrorBanner(null);

    abortControllerRef.current = new AbortController();
    try {
      await sendMessage(text, 'sql', 'architecture');
      const conv = conversations.find(c => c.id === convId);
      updateConv(convId, {
        title: conv?.title === 'Nouvelle conversation' ? titleFromMessage(text) : conv?.title,
        messageCount: messages.length + 2,
      });
    } catch (err) {
      if (err?.name !== 'AbortError') setErrorBanner(`Échec : ${err?.message || 'erreur inconnue'}`);
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsSending(false);
  };

  const handleRegenerate = (msg) => {
    const idx = messages.findIndex(m => m.id === msg.id);
    if (idx <= 0) return;
    let lastUser = null;
    for (let i = idx - 1; i >= 0; i--) if (messages[i].role === 'user') { lastUser = messages[i]; break; }
    if (lastUser?.content) handleSend(lastUser.content);
  };

  const handleEditUser = (msg) => {
    setEditingId(msg.id);
    setInput(msg.content || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleFeedback = (msg, kind) => {
    try {
      fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msg.id, kind, content: msg.content?.slice(0, 280) }),
      });
    } catch { /* silencieux */ }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), conversations }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `atlas-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const inputCount   = input.length;
  const inputOver    = inputCount > MAX_INPUT_CHARS;
  const showCounter  = inputCount > MAX_INPUT_CHARS * 0.8;
  const isEmpty      = messages.length === 0;

  return (
    <div
      className="flex h-full w-full text-zinc-200 overflow-hidden"
      style={{ background: embedded ? 'transparent' : '#070709' }}
      role="region"
      aria-label="Atlas — assistant conversationnel"
    >
      {/* Sidebar */}
      {!embedded && (
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onCreate={handleNewConversation}
          onDelete={removeConv}
          onRename={renameConv}
          onTogglePin={togglePin}
          onExport={handleExport}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed(c => !c)}
        />
      )}

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header minimal — uniquement si non embedded ET conv active */}
        {!embedded && (
          <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-white/[0.03]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  isSending ? 'bg-amber-400 animate-pulse' : networkOnline ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
                aria-hidden="true"
              />
              <h2 className="text-[13px] font-medium text-zinc-300 truncate max-w-md">
                {activeConv?.title || 'Atlas'}
              </h2>
            </div>
            <div className="flex items-center gap-0.5">
              {!networkOnline && <WifiOff size={12} className="text-rose-400" />}
              <button
                onClick={handleNewConversation}
                className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
                title="Nouvelle conversation (Ctrl+K)"
                aria-label="Nouvelle conversation"
              >
                <Plus size={14} />
              </button>
            </div>
          </header>
        )}

        {/* Bandeau erreur */}
        <AnimatePresence>
          {errorBanner && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-rose-500/[0.08] border-b border-rose-500/20 px-4 py-1.5 text-[12px] text-rose-200 flex items-center justify-between"
            >
              <span>{errorBanner}</span>
              <button onClick={() => setErrorBanner(null)} className="text-rose-300 hover:text-white" aria-label="Fermer">
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div
          ref={messagesScrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar relative"
          role="log"
          aria-live="polite"
          aria-atomic="false"
        >
          {isEmpty ? (
            <EmptyHero
              canChat={canChat}
              onPick={(s) => { setInput(s); textareaRef.current?.focus(); }}
            />
          ) : (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-7">
              {messages.map((msg, idx) => {
                const isLast = idx === messages.length - 1;
                const streaming = isSending && isLast && msg.role === 'assistant';
                if (msg.role === 'user') {
                  return <UserMessage key={msg.id ?? idx} msg={msg} onEdit={handleEditUser} />;
                }
                return (
                  <AssistantMessage
                    key={msg.id ?? idx}
                    msg={msg}
                    isLast={isLast}
                    isStreaming={streaming}
                    onRegenerate={idx > 0 ? handleRegenerate : null}
                    onFeedback={handleFeedback}
                  />
                );
              })}

              {/* "Atlas réfléchit" si dernière bulle = utilisateur */}
              {isSending && messages[messages.length - 1]?.role === 'user' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3.5">
                  <AtlasMark size={28} />
                  <div className="flex gap-1 pt-2">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
                        className="w-1.5 h-1.5 rounded-full bg-violet-400"
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
          )}

          {/* Scroll-to-bottom flottant */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={scrollToBottom}
                className="absolute right-6 bottom-4 w-8 h-8 rounded-full bg-zinc-800/90 border border-white/[0.06] text-zinc-300 hover:text-white hover:bg-zinc-700 backdrop-blur flex items-center justify-center"
                aria-label="Aller en bas"
                title="Aller en bas"
              >
                <ChevronDown size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Composer flottant */}
        <div className="px-4 sm:px-6 pb-4 pt-2 shrink-0">
          {/* Bandeau édition */}
          {editingId && (
            <div className="max-w-3xl mx-auto mb-2 flex items-center justify-between text-[11.5px] text-amber-200/90 bg-amber-500/[0.08] border border-amber-500/20 rounded-md px-3 py-1.5">
              <span className="flex items-center gap-2"><Edit3 size={11} /> Édition d’un message</span>
              <button onClick={() => { setEditingId(null); setInput(''); }} className="hover:text-white" aria-label="Annuler">
                <X size={11} />
              </button>
            </div>
          )}

          <div className={`max-w-3xl mx-auto ${isEmpty ? 'pb-8' : ''}`}>
            <div
              className={`relative rounded-3xl transition-all bg-white ${
                inputOver
                  ? 'border border-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.08)]'
                  : 'border border-slate-200 focus-within:border-violet-300 focus-within:shadow-[0_8px_24px_rgba(0,0,0,0.08),0_0_0_3px_rgba(139,92,246,0.06)]'
              }`}
            >
              <label htmlFor="atlas-input" className="sr-only">Message pour Atlas</label>
              <textarea
                id="atlas-input"
                ref={textareaRef}
                value={input}
                onFocus={() => setShowHints(true)}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={!canChat}
                placeholder={canChat ? 'Demandez à Atlas…' : 'Connectez une source pour démarrer'}
                rows={1}
                aria-label="Saisir votre message"
                className="w-full bg-transparent text-[14.5px] leading-[1.55] text-slate-800 placeholder:text-slate-400 px-5 pt-4 pb-12 resize-none focus:outline-none disabled:cursor-not-allowed"
                style={{ maxHeight: 220 }}
              />

              {/* Barre du composer */}
              <div className="absolute left-3 right-3 bottom-2.5 flex items-center justify-between pointer-events-none">
                {/* Hints fugitifs à gauche */}
                <AnimatePresence>
                  {showHints && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-[10px] text-zinc-600 pointer-events-auto select-none flex items-center gap-1.5"
                    >
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9.5px] text-slate-500 font-mono">↵</kbd>
                      <span>envoyer</span>
                      <span className="text-slate-300">·</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9.5px] text-slate-500 font-mono">⇧↵</kbd>
                      <span>nouvelle ligne</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!showHints && <div />}

                {/* Compteur (apparaît seulement si > 80%) + bouton envoi */}
                <div className="flex items-center gap-2.5 pointer-events-auto ml-auto">
                  {showCounter && (
                    <span className={`text-[10.5px] font-mono tabular-nums ${inputOver ? 'text-rose-500' : 'text-slate-400'}`}>
                      {inputCount}/{MAX_INPUT_CHARS}
                    </span>
                  )}

                  {isSending ? (
                    <button
                      onClick={handleStop}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 transition-colors"
                      aria-label="Arrêter"
                      title="Arrêter (Esc)"
                    >
                      <Square size={11} fill="currentColor" />
                    </button>
                  ) : (
                    <motion.button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || inputOver || !canChat}
                      whileTap={input.trim() && !inputOver && canChat ? { scale: 0.94 } : {}}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        background: input.trim() && !inputOver && canChat
                          ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)'
                          : 'rgba(255,255,255,0.05)',
                        boxShadow: input.trim() && !inputOver && canChat
                          ? '0 4px 12px rgba(139,92,246,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)'
                          : 'none',
                      }}
                      aria-label="Envoyer"
                    >
                      <Send size={13} strokeWidth={2.4} style={{ transform: 'translate(0.5px, -0.5px)' }} />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
