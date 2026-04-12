// src/components/HumanReviewPanel.jsx — Panel Human-in-the-Loop professionnel
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, Download, MessageSquare } from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import SchemaChangesDiff from './SchemaChangesDiff';
import { apiClient } from '../api/client';

export default function HumanReviewPanel() {
  const {
    pipelineStatus, sessionId, validatePipeline,
    sqlDDL, previousSqlDDL, criticReview,
    schemaDriftDetected, schemaDriftDetails,
    logicalModelVersion, etlCode, userPrefix,
  } = usePipelineStore();

  const [comment,      setComment]      = useState('');
  const [showCritic,   setShowCritic]   = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  if (pipelineStatus !== 'awaiting_review') return null;

  const handleValidate = async (validated) => {
    setIsValidating(true);
    await validatePipeline(validated, comment);
    setComment('');
    setIsValidating(false);
  };

  return (
    <motion.div
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
        <div className="ml-auto">
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

      {/* Rapport critique (dépliable) */}
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

      {/* Commentaire */}
      <div className="relative">
        <MessageSquare size={10} className="absolute top-2.5 left-3 text-zinc-600 pointer-events-none" />
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Commentaire optionnel (modification souhaitée, remarque...)"
          rows={2}
          className="w-full bg-zinc-900/60 text-[11px] text-zinc-300 border border-zinc-700/50 rounded-lg pl-7 pr-3 py-2
            focus:outline-none focus:border-indigo-500/40 resize-none placeholder:text-zinc-700 transition-colors"
        />
      </div>

      {/* Boutons de décision */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleValidate(true)}
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
          onClick={() => handleValidate(false)}
          disabled={isValidating}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl
            bg-rose-500/10 hover:bg-rose-500/20 text-rose-400
            border border-rose-500/20 font-black text-[11px] transition-all
            disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          <XCircle size={13} />
          Modifier
        </button>
      </div>
    </motion.div>
  );
}
