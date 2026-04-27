// src/components/HumanReviewPanel.jsx — HITL v3.0 avec état persistant de modification
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Download, MessageSquare, Loader2, Sparkles, ArrowRight, RefreshCw,
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import SchemaChangesDiff from './SchemaChangesDiff';
import { apiClient } from '../api/client';

// Agents qui tournent pendant la phase de modification
const MODIFIER_AGENTS = ['chat_modifier', 'critic', 'human_review'];
const MODIFIER_LABELS = {
  chat_modifier: '💬 Application de votre modification...',
  critic:        '⚖️ Validation du nouveau schéma...',
  human_review:  '👤 Préparation de la revue...',
};

export default function HumanReviewPanel() {
  const {
    pipelineStatus, sessionId, validatePipeline,
    sqlDDL, previousSqlDDL, criticReview,
    schemaDriftDetected, schemaDriftDetails,
    logicalModelVersion, etlCode, userPrefix,
    agentStatuses, currentAgent,
  } = usePipelineStore();

  const [comment,      setComment]      = useState('');
  const [showCritic,   setShowCritic]   = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // ── État persistant de modification ─────────────────────────────────────────
  // Reste visible entre "Modifier" cliqué et la prochaine pause HITL
  const [pendingMod, setPendingMod] = useState(null); // { comment, ts, iteration }
  const prevStatusRef = useRef(pipelineStatus);

  // Quand le pipeline revient en awaiting_review → nouvelle révision arrivée
  useEffect(() => {
    if (
      pipelineStatus === 'awaiting_review' &&
      prevStatusRef.current !== 'awaiting_review' &&
      pendingMod
    ) {
      // Petite pause pour que le diff s'affiche proprement
      setTimeout(() => setPendingMod(null), 200);
    }
    prevStatusRef.current = pipelineStatus;
  }, [pipelineStatus, pendingMod]);

  // Rien à afficher si pas en attente de review ET pas en modification
  if (pipelineStatus !== 'awaiting_review' && !pendingMod) return null;

  const handleValidate = async () => {
    setIsValidating(true);
    await validatePipeline(true, comment);
    setComment('');
    setIsValidating(false);
  };

  const handleModify = async () => {
    if (!comment.trim()) return;
    setIsValidating(true);
    const savedComment = comment;
    const iteration    = (logicalModelVersion || 0) + 1;
    setPendingMod({ comment: savedComment, ts: Date.now(), iteration });
    await validatePipeline(false, savedComment);
    setComment('');
    setIsValidating(false);
  };

  // ── Mode "modification en cours" ─────────────────────────────────────────────
  if (pendingMod) {
    const activeLabel = MODIFIER_LABELS[currentAgent] ||
      (currentAgent ? `⚙️ ${currentAgent}…` : '⚙️ Agent en cours…');

    return (
      <motion.div
        key="pending"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-indigo-500/30 bg-indigo-500/5 rounded-xl p-4 space-y-3"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Loader2 size={14} className="text-indigo-400 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-black text-indigo-300">Modification en cours</h3>
            <p className="text-[10px] text-indigo-400/60 mt-0.5 truncate">{activeLabel}</p>
          </div>
          <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-full font-mono shrink-0">
            v{pendingMod.iteration}
          </span>
        </div>

        {/* Votre demande */}
        <div className="rounded-xl border border-indigo-500/20 bg-black/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare size={10} className="text-indigo-400" />
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">Votre demande</span>
          </div>
          <p className="text-[11px] text-indigo-200/80 leading-relaxed italic">"{pendingMod.comment}"</p>
        </div>

        {/* Progress steps */}
        <div className="space-y-1.5">
          {MODIFIER_AGENTS.map((agent) => {
            const status = agentStatuses?.[agent];
            const isDone    = status === 'done';
            const isRunning = status === 'running';
            const isPending = !isDone && !isRunning;
            return (
              <div key={agent} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
                isRunning ? 'bg-indigo-500/15 border border-indigo-500/25' :
                isDone    ? 'bg-emerald-500/10 border border-emerald-500/20' :
                            'bg-white/[0.02] border border-white/[0.04]'
              }`}>
                {isRunning ? (
                  <Loader2 size={10} className="text-indigo-400 animate-spin shrink-0" />
                ) : isDone ? (
                  <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full border border-slate-700 shrink-0" />
                )}
                <span className={`text-[10px] font-semibold ${
                  isRunning ? 'text-indigo-300' :
                  isDone    ? 'text-emerald-400' :
                              'text-slate-600'
                }`}>
                  {MODIFIER_LABELS[agent]?.replace(/^.{2} /, '') || agent}
                </span>
                {isRunning && (
                  <span className="ml-auto text-[8px] text-indigo-400/60 animate-pulse font-mono">en cours...</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[9px] text-slate-600 text-center">
          Le schéma révisé apparaîtra ici dès que l'agent aura terminé
        </p>
      </motion.div>
    );
  }

  // ── Mode "review normal" ──────────────────────────────────────────────────────
  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-amber-500/25 bg-amber-500/5 rounded-xl p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
          <span className="text-sm">👤</span>
        </div>
        <div>
          <h3 className="text-xs font-black text-amber-300">Validation requise</h3>
          <p className="text-[10px] text-amber-400/60 mt-0.5">Examinez et validez avant le déploiement ETL</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {logicalModelVersion > 1 && (
            <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
              ✓ Modifié
            </span>
          )}
          <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-full font-mono">
            v{logicalModelVersion}
          </span>
        </div>
      </div>

      {/* Schema diff */}
      <SchemaChangesDiff
        previousDdl={previousSqlDDL}
        currentDdl={sqlDDL}
        driftDetails={schemaDriftDetected ? schemaDriftDetails : ''}
        version={logicalModelVersion}
      />

      {/* Rapport critique */}
      {criticReview && (
        <div className="rounded-lg border border-zinc-700/50 overflow-hidden">
          <button
            onClick={() => setShowCritic(s => !s)}
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800/50 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={10} className="text-rose-400" />
              Rapport du Critic
            </span>
            {showCritic ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <AnimatePresence>
            {showCritic && (
              <motion.div
                initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 text-[10px] text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono bg-zinc-900/50 max-h-40 overflow-y-auto border-t border-zinc-800/60">
                  {criticReview}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Export .ktr */}
      {etlCode && (
        <a
          href={apiClient.getKtrDownloadUrl(sessionId)}
          download={`${userPrefix || 'dw'}_pipeline.ktr`}
          className="flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 w-full"
        >
          <Download size={11} />
          Télécharger le fichier .ktr Pentaho
        </a>
      )}

      {/* Zone de commentaire */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={9} className="text-indigo-400" />
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
            Demander une modification (optionnel)
          </span>
        </div>
        <div className="relative">
          <MessageSquare size={10} className="absolute top-2.5 left-3 text-zinc-600 pointer-events-none" />
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder='Ex: "Ajoute une colonne total_ttc dans la table de faits" ou "Renomme dim_client en dim_customer"'
            rows={2}
            className="w-full bg-zinc-900/60 text-[11px] text-zinc-300 border border-zinc-700/50 rounded-lg pl-7 pr-3 py-2
              focus:outline-none focus:border-indigo-500/40 resize-none placeholder:text-zinc-700 transition-colors"
          />
        </div>
        {comment.trim() && (
          <p className="text-[9px] text-indigo-400/70 flex items-center gap-1">
            <ArrowRight size={8} />
            L'agent appliquera cette modification avant le déploiement
          </p>
        )}
      </div>

      {/* Boutons de décision */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleValidate}
          disabled={isValidating}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl
            bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400
            border border-emerald-500/25 font-black text-[11px] transition-all
            disabled:opacity-50 disabled:cursor-not-allowed active:scale-95
            hover:shadow-[0_0_12px_rgba(34,197,94,0.2)]"
        >
          <CheckCircle2 size={13} />
          {isValidating ? 'Lancement...' : 'Valider & Déployer'}
        </button>
        <button
          onClick={handleModify}
          disabled={isValidating || !comment.trim()}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl
            bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400
            border border-indigo-500/20 font-black text-[11px] transition-all
            disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          title={!comment.trim() ? 'Écrivez votre demande ci-dessus' : ''}
        >
          <RefreshCw size={13} />
          Modifier le schéma
        </button>
      </div>

      {!comment.trim() && (
        <p className="text-[9px] text-slate-600 text-center">
          Écrivez une modification ci-dessus puis cliquez "Modifier le schéma"
        </p>
      )}
    </motion.div>
  );
}
