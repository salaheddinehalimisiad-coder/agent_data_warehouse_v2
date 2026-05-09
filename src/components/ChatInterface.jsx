// src/components/ChatInterface.jsx
// Atlas — Assistant conversationnel professionnel
// UI inspirée de ChatGPT / Claude / Gemini, refondue pour solidité et qualité.
// Fonctionnalités :
//   • Sidebar conversations persistées localStorage (titre auto, recherche, suppression, export)
//   • Empty state avec prompts groupés par catégorie
//   • Bulles avec actions au survol : copier, régénérer, éditer, thumbs up/down
//   • Streaming SSE avec curseur clignotant + bouton STOP
//   • Markdown léger : code blocks (avec copy + langage), listes, gras, italique, liens, h1-h3
//   • Auto-scroll intelligent (ne force pas si l'utilisateur a scrollé vers le haut)
//   • Brouillon auto-sauvegardé, draft restauré au refresh
//   • Raccourcis clavier (Entrée, Maj+Entrée, Esc pour stop, Ctrl/Cmd+K nouvelle conv, Ctrl+/ focus)
//   • Compteur de caractères, limite 4000
//   • État réseau / connexion / modèle dans la barre d'état
//   • Accessibilité (ARIA roles, labels, live regions)

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Send, Square, Copy, Check, Bot, Loader2, Sparkles, Plus, Search,
  Edit3, RotateCcw, ThumbsUp, ThumbsDown, Trash2, Download, Share2,
  ChevronLeft, ChevronRight, MessageSquare, X, Cpu, Settings, Wifi, WifiOff,
  Paperclip, AtSign, Menu, MoreHorizontal, Pencil, Pin, Code, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { usePipelineStore } from '../store/pipelineStore';

// ============================================================================
//  CONSTANTES & UTILITAIRES
// ============================================================================
const MAX_INPUT_CHARS = 4000;
const STORAGE_CONVS = 'atlas:conversations:v2';
const STORAGE_DRAFT = 'atlas:draft:v1';
const STORAGE_ACTIVE = 'atlas:active-conv:v1';

const SUGGESTION_GROUPS = [
  {
    icon: Database,
    title: 'Modélisation',
    color: 'text-violet-300',
    items: [
      'Ajoute une mesure net_amount à fact_sales',
      'Renomme dim_client en dim_customer',
      'Convertis dim_product en SCD Type 2',
      'Crée des role-playing dates pour fact_orders',
    ],
  },
  {
    icon: Code,
    title: 'Audit & Qualité',
    color: 'text-cyan-300',
    items: [
      'Vérifie l\'intégrité référentielle de mon schéma',
      'Liste les colonnes sans index',
      'Détecte les colonnes PII non masquées',
      'Audit Kimball complet du modèle',
    ],
  },
  {
    icon: Sparkles,
    title: 'Analyse',
    color: 'text-amber-300',
    items: [
      'Compare le CA 2024 vs 2023 par région',
      'Top 10 des produits les plus rentables',
      'Évolution mensuelle de l\'attrition',
      'Génère 5 KPI pour ma direction',
    ],
  },
];

const uid = () => `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const formatTime = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const formatRelative = (ts) => {
  const diff = Date.now() - ts;
  if (diff < 60_000)        return 'À l\'instant';
  if (diff < 3_600_000)     return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000)    return `Il y a ${Math.floor(diff / 3_600_000)} h`;
  if (diff < 604_800_000)   return `Il y a ${Math.floor(diff / 86_400_000)} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const safeReadLS = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};
const safeWriteLS = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota / private mode */ }
};

const titleFromMessage = (text) => {
  const cleaned = (text || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Nouvelle conversation';
  return cleaned.slice(0, 60) + (cleaned.length > 60 ? '…' : '');
};

// ============================================================================
//  HOOK : conversations persistées
// ============================================================================
function useConversations() {
  const [conversations, setConversations] = useState(() => safeReadLS(STORAGE_CONVS, []));
  const [activeId, setActiveId] = useState(() => safeReadLS(STORAGE_ACTIVE, null));

  useEffect(() => safeWriteLS(STORAGE_CONVS, conversations), [conversations]);
  useEffect(() => safeWriteLS(STORAGE_ACTIVE, activeId), [activeId]);

  const createConv = useCallback(() => {
    const conv = { id: uid(), title: 'Nouvelle conversation', createdAt: Date.now(), updatedAt: Date.now(), pinned: false, messageCount: 0 };
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

  const togglePin = useCallback((id) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));
  }, []);

  const renameConv = useCallback((id, title) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  }, []);

  return { conversations, activeId, setActiveId, createConv, updateConv, removeConv, togglePin, renameConv };
}

// ============================================================================
//  COMPOSANT : code block avec bouton COPY
// ============================================================================
function CodeBlock({ code, lang = 'sql' }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0a0a10]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04] border-b border-white/[0.06]">
        <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-widest">{lang}</span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label="Copier le code"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={vscDarkPlus}
        customStyle={{
          margin: 0, padding: '0.95rem 1rem', background: 'transparent',
          fontSize: '12.5px', lineHeight: '1.65',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// ============================================================================
//  COMPOSANT : rendu Markdown léger
// ============================================================================
function MarkdownContent({ content }) {
  // Parse en alternance : code-blocks vs prose
  const parts = useMemo(() => {
    const out = [];
    const re = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;
    let lastIdx = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      if (m.index > lastIdx) out.push({ type: 'prose', text: content.slice(lastIdx, m.index) });
      out.push({ type: 'code', lang: m[1] || 'plaintext', code: m[2] });
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < content.length) out.push({ type: 'prose', text: content.slice(lastIdx) });
    return out;
  }, [content]);

  const renderInline = (text) => {
    // gras, italique, code inline, liens
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/`([^`]+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/[0.07] text-violet-200 font-mono text-[12px]">$1</code>')
      .replace(/\*\*([^*]+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      .replace(/(?:^|\s)\*([^*\n]+?)\*(?=\s|$)/g, ' <em class="text-zinc-300 italic">$1</em>')
      .replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="text-violet-300 hover:text-violet-200 underline underline-offset-2" href="$2" target="_blank" rel="noopener">$1</a>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const renderProse = (text) => {
    const lines = text.split('\n');
    const blocks = [];
    let listBuffer = null; // { type: 'ul'|'ol', items: [] }

    const flushList = () => {
      if (!listBuffer) return;
      const Tag = listBuffer.type;
      blocks.push(
        <Tag key={`list-${blocks.length}`} className={`my-2 ${listBuffer.type === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-1`}>
          {listBuffer.items.map((it, i) => <li key={i} className="text-zinc-300 leading-relaxed">{renderInline(it)}</li>)}
        </Tag>
      );
      listBuffer = null;
    };

    lines.forEach((raw, i) => {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) {
        flushList();
        return;
      }
      // Headings
      if (/^### /.test(line))      { flushList(); blocks.push(<h3 key={i} className="mt-3 mb-1.5 text-[14.5px] font-bold text-white">{renderInline(line.slice(4))}</h3>); return; }
      if (/^## /.test(line))       { flushList(); blocks.push(<h2 key={i} className="mt-3 mb-1.5 text-[15.5px] font-bold text-white">{renderInline(line.slice(3))}</h2>); return; }
      if (/^# /.test(line))        { flushList(); blocks.push(<h1 key={i} className="mt-3 mb-2 text-[17px] font-bold text-white">{renderInline(line.slice(2))}</h1>); return; }
      // Listes
      const ulMatch = line.match(/^\s*[-*•]\s+(.*)$/);
      const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      if (ulMatch) {
        if (!listBuffer || listBuffer.type !== 'ul') { flushList(); listBuffer = { type: 'ul', items: [] }; }
        listBuffer.items.push(ulMatch[1]);
        return;
      }
      if (olMatch) {
        if (!listBuffer || listBuffer.type !== 'ol') { flushList(); listBuffer = { type: 'ol', items: [] }; }
        listBuffer.items.push(olMatch[1]);
        return;
      }
      flushList();
      // Citation
      if (/^>\s/.test(line)) {
        blocks.push(<blockquote key={i} className="my-2 pl-3 border-l-2 border-violet-500/40 text-zinc-400 italic">{renderInline(line.slice(2))}</blockquote>);
        return;
      }
      // Paragraphe normal
      blocks.push(<p key={i} className="text-zinc-300 leading-[1.65]">{renderInline(line)}</p>);
    });
    flushList();
    return <div className="space-y-1.5">{blocks}</div>;
  };

  return (
    <div className="text-[13.5px]">
      {parts.map((p, i) => p.type === 'code'
        ? <CodeBlock key={i} code={p.code} lang={p.lang} />
        : <div key={i}>{renderProse(p.text)}</div>
      )}
    </div>
  );
}

// ============================================================================
//  COMPOSANT : bulle de message avec actions au survol
// ============================================================================
function MessageBubble({ msg, isLast, isStreaming, onCopy, onRegenerate, onEdit, onFeedback }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isUser = msg.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
    onCopy?.(msg);
  };

  const sendFeedback = (kind) => {
    setFeedback(kind);
    onFeedback?.(msg, kind);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        aria-hidden="true"
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${
          isUser
            ? 'bg-zinc-700 text-zinc-200'
            : 'bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/25'
        }`}
      >
        {isUser ? <span className="text-[12px] font-bold">Vous</span> : <Bot size={16} strokeWidth={2.2} />}
      </div>

      {/* Bulle + actions */}
      <div className={`min-w-0 max-w-[88%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-3 rounded-2xl border ${
            isUser
              ? 'bg-violet-600/15 border-violet-500/25 text-white rounded-tr-sm'
              : 'bg-white/[0.03] border-white/[0.07] text-zinc-200 rounded-tl-sm backdrop-blur-sm'
          }`}
        >
          {msg.content || msg.content === ''
            ? (
              <div className="break-words">
                {isUser ? (
                  <div className="text-[13.5px] leading-[1.6] whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <>
                    <MarkdownContent content={msg.content || ''} />
                    {isStreaming && isLast && (
                      <span className="inline-block w-[7px] h-[15px] ml-0.5 align-middle bg-violet-400 animate-pulse rounded-sm" aria-hidden="true" />
                    )}
                  </>
                )}
              </div>
            )
            : null
          }
        </div>

        {/* Métadonnée + actions */}
        <div className={`flex items-center gap-2 mt-1.5 px-1 transition-opacity ${isUser ? 'flex-row-reverse' : 'flex-row'} ${isLast || copied || feedback ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <span className="text-[10px] text-zinc-600 font-mono">{formatTime(msg.timestamp || Date.now())}</span>

          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label="Copier le message"
            title="Copier"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          </button>

          {!isUser && (
            <>
              {onRegenerate && (
                <button
                  onClick={() => onRegenerate(msg)}
                  className="p-1 rounded hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-200 transition-colors"
                  aria-label="Régénérer la réponse"
                  title="Régénérer"
                >
                  <RotateCcw size={11} />
                </button>
              )}
              <button
                onClick={() => sendFeedback('up')}
                className={`p-1 rounded hover:bg-white/[0.06] transition-colors ${feedback === 'up' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-200'}`}
                aria-label="Réponse utile"
                title="Utile"
              >
                <ThumbsUp size={11} />
              </button>
              <button
                onClick={() => sendFeedback('down')}
                className={`p-1 rounded hover:bg-white/[0.06] transition-colors ${feedback === 'down' ? 'text-rose-400' : 'text-zinc-500 hover:text-zinc-200'}`}
                aria-label="Réponse pas utile"
                title="Pas utile"
              >
                <ThumbsDown size={11} />
              </button>
            </>
          )}

          {isUser && onEdit && (
            <button
              onClick={() => onEdit(msg)}
              className="p-1 rounded hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label="Modifier le message"
              title="Modifier"
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
//  COMPOSANT : empty state avec prompts groupés
// ============================================================================
function EmptyState({ canChat, onPickSuggestion }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-10">
      {/* Logo Atlas */}
      <div className="relative mb-6">
        <div className="absolute inset-0 blur-2xl rounded-full bg-violet-500/30" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-violet-500/30">
          <Bot size={30} strokeWidth={2.1} className="text-white" />
        </div>
      </div>
      <h1 className="text-[22px] font-bold text-white mb-1.5 tracking-tight">Bonjour, je suis Atlas</h1>
      <p className="text-[13px] text-zinc-500 mb-8 text-center max-w-md leading-relaxed">
        {canChat
          ? 'Votre architecte ETL et Data Warehouse. Posez une question, décrivez une modification, ou demandez une analyse de votre schéma.'
          : 'Connectez une source de données pour démarrer.'}
      </p>

      {canChat && (
        <div className="w-full max-w-2xl grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SUGGESTION_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className={`flex items-center gap-2 mb-2.5 ${group.color}`}>
                  <Icon size={13} />
                  <span className="text-[10.5px] font-bold uppercase tracking-widest">{group.title}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.items.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onPickSuggestion(s)}
                      className="text-left text-[12px] text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-md hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all leading-snug"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-[10.5px] text-zinc-600 italic max-w-md text-center">
        Astuce : appuyez sur <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-zinc-400 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-zinc-400 font-mono text-[10px]">K</kbd> pour démarrer une nouvelle conversation à tout moment.
      </p>
    </div>
  );
}

// ============================================================================
//  COMPOSANT : sidebar des conversations
// ============================================================================
function ConversationsSidebar({
  conversations, activeId, onSelect, onCreate, onDelete, onRename, onTogglePin,
  collapsed, onToggleCollapsed, onExport
}) {
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = conversations;
    if (q) list = list.filter(c => (c.title || '').toLowerCase().includes(q));
    // pinned d'abord, puis updatedAt desc
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }, [conversations, query]);

  if (collapsed) {
    return (
      <div className="w-12 shrink-0 border-r border-white/[0.06] bg-black/30 flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapsed}
          className="p-2 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors"
          aria-label="Ouvrir l'historique"
          title="Historique"
        >
          <Menu size={16} />
        </button>
        <button
          onClick={onCreate}
          className="p-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 transition-colors"
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation (Ctrl+K)"
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-[260px] shrink-0 border-r border-white/[0.06] bg-black/30 flex flex-col">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <button
          onClick={onCreate}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/25 text-violet-100 text-[12.5px] font-semibold transition-colors"
        >
          <Plus size={13} />
          Nouvelle conversation
        </button>
        <button
          onClick={onToggleCollapsed}
          className="p-2 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors"
          aria-label="Réduire l'historique"
          title="Réduire"
        >
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* Recherche */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-8 pr-2 py-1.5 text-[12px] rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:bg-white/[0.05]"
          />
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-3 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[11px] text-zinc-600">
            {query ? 'Aucun résultat' : 'Aucune conversation'}
          </div>
        ) : (
          filtered.map((c) => {
            const isActive = c.id === activeId;
            const isRenaming = renamingId === c.id;
            return (
              <div
                key={c.id}
                onClick={() => !isRenaming && onSelect(c.id)}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-all ${
                  isActive
                    ? 'bg-violet-600/15 border border-violet-500/20'
                    : 'hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <MessageSquare size={12} className={isActive ? 'text-violet-300' : 'text-zinc-500'} />
                {isRenaming ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => { onRename(c.id, renameValue.trim() || c.title); setRenamingId(null); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { onRename(c.id, renameValue.trim() || c.title); setRenamingId(null); }
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="flex-1 min-w-0 bg-white/[0.05] border border-violet-500/30 rounded px-1.5 py-0.5 text-[12px] text-white focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] truncate ${isActive ? 'text-white font-medium' : 'text-zinc-300'}`}>
                      {c.pinned && <Pin size={9} className="inline mr-1 text-amber-400" />}
                      {c.title}
                    </div>
                    <div className="text-[9.5px] text-zinc-600 mt-0.5">
                      {formatRelative(c.updatedAt || c.createdAt)} · {c.messageCount || 0} msg
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!isRenaming && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onTogglePin(c.id); }}
                      className="p-1 rounded hover:bg-white/[0.08] text-zinc-500 hover:text-amber-400"
                      aria-label="Épingler"
                      title="Épingler"
                    >
                      <Pin size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.title); }}
                      className="p-1 rounded hover:bg-white/[0.08] text-zinc-500 hover:text-white"
                      aria-label="Renommer"
                      title="Renommer"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer cette conversation ?')) onDelete(c.id); }}
                      className="p-1 rounded hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400"
                      aria-label="Supprimer"
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
      <div className="border-t border-white/[0.06] px-3 py-2 flex items-center justify-between">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 text-[10.5px] font-semibold text-zinc-500 hover:text-zinc-200 transition-colors"
          title="Exporter toutes les conversations"
        >
          <Download size={11} />
          Exporter
        </button>
        <span className="text-[10px] text-zinc-600 font-mono">{conversations.length} conv.</span>
      </div>
    </aside>
  );
}

// ============================================================================
//  COMPOSANT PRINCIPAL : ChatInterface
// ============================================================================
export default function ChatInterface({ embedded = false }) {
  const { messages, sendMessage, pipelineStatus } = usePipelineStore();
  const { conversations, activeId, setActiveId, createConv, updateConv, removeConv, togglePin, renameConv } = useConversations();

  // État UI local
  const [input, setInput]                 = useState(() => safeReadLS(STORAGE_DRAFT, ''));
  const [isSending, setIsSending]         = useState(false);
  const [streamingId, setStreamingId]     = useState(null);
  const [editingId, setEditingId]         = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(embedded);
  const [autoScroll, setAutoScroll]       = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [errorBanner, setErrorBanner]     = useState(null);

  const messagesEndRef     = useRef(null);
  const messagesScrollRef  = useRef(null);
  const textareaRef        = useRef(null);
  const abortControllerRef = useRef(null);
  const previousMsgCountRef = useRef(messages.length);

  const canChat = pipelineStatus !== 'idle';

  // ── Brouillon : sauvegarde automatique ──────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => safeWriteLS(STORAGE_DRAFT, input), 300);
    return () => clearTimeout(t);
  }, [input]);

  // ── État réseau ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onOnline  = () => { setNetworkOnline(true); setErrorBanner(null); };
    const onOffline = () => { setNetworkOnline(false); setErrorBanner('Connexion perdue. Vos messages sont conservés et seront envoyés au retour du réseau.'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // ── Auto-scroll intelligent ──────────────────────────────────────────────
  useEffect(() => {
    const newCount = messages.length;
    const grew = newCount > previousMsgCountRef.current;
    previousMsgCountRef.current = newCount;
    if (grew && autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, autoScroll]);

  // Streaming en cours : auto-scroll fluide pendant l'arrivée des tokens
  useEffect(() => {
    if (!isSending || !autoScroll) return;
    const id = setInterval(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 250);
    return () => clearInterval(id);
  }, [isSending, autoScroll]);

  const handleScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 80;
    setAutoScroll(atBottom);
    setShowScrollBtn(!atBottom && messages.length > 0);
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  // ── Raccourcis clavier ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      // Ctrl/Cmd + K : nouvelle conversation
      if (meta && e.key === 'k') {
        e.preventDefault();
        handleNewConversation();
      }
      // Ctrl + / : focus input
      if (meta && e.key === '/') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
      // Esc : stop génération si en cours
      if (e.key === 'Escape' && isSending) {
        e.preventDefault();
        handleStop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSending]);

  // ── Auto-resize textarea ─────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
  }, [input]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleNewConversation = () => {
    const id = createConv();
    setInput('');
    setEditingId(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
    return id;
  };

  const handleSend = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || isSending) return;
    if (text.length > MAX_INPUT_CHARS) {
      setErrorBanner(`Message trop long (${text.length} caractères, maximum ${MAX_INPUT_CHARS}).`);
      return;
    }

    // Crée une conversation si aucune n'est active
    let convId = activeId;
    if (!convId) convId = handleNewConversation();

    setInput('');
    safeWriteLS(STORAGE_DRAFT, '');
    setEditingId(null);
    setIsSending(true);
    setErrorBanner(null);

    abortControllerRef.current = new AbortController();
    try {
      // Suit la longueur des messages avant pour identifier la nouvelle bulle assistant
      const beforeLen = messages.length;
      await sendMessage(text, 'sql', 'architecture');
      // Met à jour la conversation active
      const conv = conversations.find(c => c.id === convId);
      const newCount = (messages.length + 2);
      updateConv(convId, {
        title: conv?.title === 'Nouvelle conversation' ? titleFromMessage(text) : conv?.title,
        messageCount: newCount,
      });
      // Identifie l'id de la dernière bulle assistant pour le marquer comme streamé
      // Le store lit `messages`, donc le streaming est déjà piloté par lui.
      setStreamingId(beforeLen + 1);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setErrorBanner(`Échec de l'envoi : ${err?.message || 'erreur inconnue'}. Cliquez pour réessayer.`);
      }
    } finally {
      setIsSending(false);
      setStreamingId(null);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsSending(false);
    setStreamingId(null);
  };

  const handleRegenerate = (msg) => {
    // Recherche le dernier message utilisateur
    const idx = messages.findIndex(m => m.id === msg.id);
    if (idx <= 0) return;
    let lastUser = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUser = messages[i]; break; }
    }
    if (lastUser?.content) handleSend(lastUser.content);
  };

  const handleEditUser = (msg) => {
    setEditingId(msg.id);
    setInput(msg.content || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleFeedback = (msg, kind) => {
    // Hook pour télémétrie ; ne casse pas le flow si l'API n'existe pas
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
    a.href = url;
    a.download = `atlas-conversations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const inputCount = input.length;
  const inputOver  = inputCount > MAX_INPUT_CHARS;

  return (
    <div
      className="flex h-full w-full text-zinc-200 overflow-hidden"
      style={{ background: embedded ? 'transparent' : 'linear-gradient(180deg, #0a0a12 0%, #07070d 100%)' }}
      role="region"
      aria-label="Atlas — assistant conversationnel"
    >
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      {!embedded && (
        <ConversationsSidebar
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

      {/* ── Zone principale ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header avec connexion / status / titre */}
        {!embedded && (
          <header className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06] bg-black/20 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/30 shrink-0">
                <Bot size={14} strokeWidth={2.3} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold text-white flex items-center gap-1.5">
                  Atlas
                  <Sparkles size={10} className="text-violet-400" />
                </div>
                <div className="text-[10.5px] text-zinc-500 truncate flex items-center gap-1.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${isSending ? 'bg-amber-400' : networkOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  {isSending ? 'Réflexion en cours…' : networkOnline ? 'Disponible · BLAZE GLM-5' : 'Hors ligne'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {networkOnline ? <Wifi size={13} className="text-zinc-500" /> : <WifiOff size={13} className="text-rose-400" />}
              <button
                onClick={handleNewConversation}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1.5"
                title="Nouvelle conversation (Ctrl+K)"
              >
                <Plus size={12} /> Nouveau
              </button>
            </div>
          </header>
        )}

        {/* Bandeau d'erreur */}
        <AnimatePresence>
          {errorBanner && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-rose-500/10 border-b border-rose-500/30 px-5 py-2 text-[12px] text-rose-200 flex items-center justify-between"
            >
              <span>{errorBanner}</span>
              <button onClick={() => setErrorBanner(null)} className="text-rose-300 hover:text-white">
                <X size={13} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Liste des messages */}
        <div
          ref={messagesScrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar relative"
          role="log"
          aria-live="polite"
          aria-atomic="false"
        >
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.length === 0 ? (
              <EmptyState canChat={canChat} onPickSuggestion={(s) => { setInput(s); textareaRef.current?.focus(); }} />
            ) : (
              messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id ?? idx}
                  msg={{ ...msg, timestamp: msg.timestamp || Date.now() - (messages.length - idx) * 1000 }}
                  isLast={idx === messages.length - 1}
                  isStreaming={isSending && idx === messages.length - 1 && msg.role === 'assistant'}
                  onCopy={() => {}}
                  onRegenerate={msg.role === 'assistant' && idx > 0 ? handleRegenerate : null}
                  onEdit={msg.role === 'user' ? handleEditUser : null}
                  onFeedback={handleFeedback}
                />
              ))
            )}

            {/* Indicateur "en train de réfléchir" si pas encore de bulle assistant */}
            {isSending && messages[messages.length - 1]?.role === 'user' && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-3 pl-11"
              >
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
                      className="w-1.5 h-1.5 rounded-full bg-violet-400"
                    />
                  ))}
                </div>
                <span className="text-[10.5px] font-semibold text-violet-300/80 uppercase tracking-widest">Atlas réfléchit</span>
              </motion.div>
            )}

            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          {/* Bouton "scroll to bottom" flottant */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollToBottom}
                className="absolute right-6 bottom-4 w-9 h-9 rounded-full bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-700 shadow-lg flex items-center justify-center"
                aria-label="Aller au dernier message"
                title="Aller en bas"
              >
                <ChevronRight size={15} className="rotate-90" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ── Composer ──────────────────────────────────────────────────── */}
        <div className="px-4 pb-4 pt-1 shrink-0">
          {editingId && (
            <div className="max-w-3xl mx-auto mb-2 flex items-center justify-between text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-1.5">
              <span className="flex items-center gap-2"><Edit3 size={11} /> Édition d&apos;un message</span>
              <button onClick={() => { setEditingId(null); setInput(''); }} className="hover:text-white"><X size={12} /></button>
            </div>
          )}
          <div className="max-w-3xl mx-auto">
            <div
              className={`relative rounded-2xl border transition-all bg-zinc-900/70 backdrop-blur ${
                inputOver ? 'border-rose-500/50' :
                'border-white/[0.08] focus-within:border-violet-500/50 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.12)]'
              }`}
            >
              <label htmlFor="atlas-input" className="sr-only">Message pour Atlas</label>
              <textarea
                id="atlas-input"
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={!canChat}
                placeholder={canChat
                  ? 'Posez votre question, ou décrivez une modification… (Maj+Entrée pour saut de ligne)'
                  : 'Connectez une source de données pour démarrer'}
                rows={1}
                aria-label="Saisir votre message pour Atlas"
                className="w-full bg-transparent text-[14px] leading-[1.55] text-zinc-100 placeholder:text-zinc-500 px-4 pt-3.5 pb-12 resize-none focus:outline-none disabled:cursor-not-allowed"
                style={{ maxHeight: 220 }}
              />

              {/* Barre du composer : compteur, raccourcis, bouton envoi */}
              <div className="absolute left-3 right-3 bottom-2.5 flex items-center justify-between pointer-events-none gap-3">
                <div className="flex items-center gap-2 text-[10.5px] text-zinc-500 pointer-events-auto select-none">
                  <button
                    type="button"
                    disabled
                    title="Pièce jointe (bientôt)"
                    className="p-1 rounded hover:bg-white/[0.05] opacity-40 cursor-not-allowed"
                    aria-label="Pièce jointe"
                  >
                    <Paperclip size={13} />
                  </button>
                  <span className="hidden sm:inline">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[9.5px] text-zinc-400 font-mono">Entrée</kbd>
                    {' '}envoyer
                    {' · '}
                    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[9.5px] text-zinc-400 font-mono">Maj</kbd>
                    +
                    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[9.5px] text-zinc-400 font-mono">Entrée</kbd>
                    {' '}saut de ligne
                  </span>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                  <span className={`text-[10.5px] font-mono ${inputOver ? 'text-rose-400 font-bold' : 'text-zinc-500'}`}>
                    {inputCount}/{MAX_INPUT_CHARS}
                  </span>

                  {isSending ? (
                    <button
                      onClick={handleStop}
                      className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 text-[12px] font-bold transition-colors"
                      aria-label="Arrêter la génération"
                      title="Arrêter (Esc)"
                    >
                      <Square size={11} fill="currentColor" />
                      Stop
                    </button>
                  ) : (
                    <motion.button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || inputOver || !canChat}
                      whileHover={input.trim() && !inputOver && canChat ? { scale: 1.04 } : {}}
                      whileTap={input.trim() && !inputOver && canChat ? { scale: 0.96 } : {}}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        background: input.trim() && !inputOver && canChat
                          ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)'
                          : 'rgba(255,255,255,0.05)',
                        boxShadow: input.trim() && !inputOver && canChat
                          ? '0 4px 14px rgba(139,92,246,0.35), inset 0 0 0 1px rgba(255,255,255,0.06)'
                          : 'none',
                      }}
                      aria-label="Envoyer le message"
                    >
                      <Send size={14} strokeWidth={2.3} style={{ transform: 'translate(0.5px, -0.5px)' }} />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>

            {/* Pied : info modèle + politique */}
            <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-zinc-600">
              <span>Atlas peut commettre des erreurs. Vérifiez les modifications avant validation.</span>
              <span className="font-mono">v3.0.1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
