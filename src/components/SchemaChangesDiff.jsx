// src/components/SchemaChangesDiff.jsx — Diff visuel pour Human-in-the-Loop
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, AlertTriangle, CheckCircle2, GitCompare } from 'lucide-react';

function parseTables(ddl = '') {
  const tableRegex = /CREATE TABLE IF NOT EXISTS [`"]?(\w+)[`"]?\s*\(([\s\S]*?)\);/gi;
  const tables = {};
  let m;
  while ((m = tableRegex.exec(ddl)) !== null) {
    const cols = m[2]
      .split(',')
      .map(c => c.trim())
      .filter(c => c && !c.toUpperCase().startsWith('INDEX') && !c.toUpperCase().startsWith('KEY'));
    tables[m[1].toLowerCase()] = cols;
  }
  return tables;
}

function computeDiff(prevDdl, currDdl) {
  if (!prevDdl || prevDdl === currDdl) return [];
  const prev = parseTables(prevDdl);
  const curr = parseTables(currDdl);
  const changes = [];

  const allTables = new Set([...Object.keys(prev), ...Object.keys(curr)]);
  for (const table of allTables) {
    if (!prev[table] && curr[table]) { changes.push({ type: 'table_added', table }); continue; }
    if (prev[table] && !curr[table]) { changes.push({ type: 'table_removed', table }); continue; }
    const prevSet = new Set(prev[table]);
    const currSet = new Set(curr[table]);
    for (const col of currSet) if (!prevSet.has(col)) changes.push({ type: 'col_added', table, col });
    for (const col of prevSet) if (!currSet.has(col)) changes.push({ type: 'col_removed', table, col });
  }
  return changes;
}

export default function SchemaChangesDiff({ previousDdl, currentDdl, driftDetails, version }) {
  const diff = useMemo(() => computeDiff(previousDdl, currentDdl), [previousDdl, currentDdl]);

  const hasChanges = diff.length > 0 || driftDetails;
  const isFirst    = !previousDdl;

  if (isFirst) {
    return (
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-center gap-2.5">
        <CheckCircle2 size={14} className="text-indigo-400 shrink-0" />
        <span className="text-[10px] text-indigo-300 font-mono">
          Modèle initial v{version} — Première génération
        </span>
      </div>
    );
  }

  if (!hasChanges) return null;

  const added   = diff.filter(d => d.type.includes('added'));
  const removed = diff.filter(d => d.type.includes('removed'));

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-2.5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px]">
          <GitCompare size={12} />
          <span>Modifications — v{version}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {added.length > 0 && (
            <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
              <Plus size={9} />{added.length}
            </span>
          )}
          {removed.length > 0 && (
            <span className="flex items-center gap-0.5 text-rose-400 font-bold">
              <Minus size={9} />{removed.length}
            </span>
          )}
        </div>
      </div>

      {/* Drift details */}
      {driftDetails && (
        <div className="text-[10px] text-amber-300/70 bg-amber-500/8 rounded-lg px-2.5 py-1.5 font-mono border border-amber-500/15">
          🔍 {driftDetails}
        </div>
      )}

      {/* Diff lines */}
      {diff.length > 0 && (
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {diff.map((change, i) => {
            const isAdd = change.type.includes('added');
            return (
              <div
                key={i}
                className={`flex items-start gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg font-mono ${
                  isAdd
                    ? 'bg-emerald-500/8 text-emerald-300 border border-emerald-500/15'
                    : 'bg-rose-500/8 text-rose-300 border border-rose-500/15'
                }`}
              >
                {isAdd ? <Plus size={9} className="mt-0.5 shrink-0" /> : <Minus size={9} className="mt-0.5 shrink-0" />}
                <span>
                  {change.type === 'table_added'   && `Nouvelle table : ${change.table}`}
                  {change.type === 'table_removed'  && `Table supprimée : ${change.table}`}
                  {change.type === 'col_added'      && <><span className="opacity-50">{change.table}</span> ← +{change.col}</>}
                  {change.type === 'col_removed'    && <><span className="opacity-50">{change.table}</span> ← -{change.col}</>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] text-amber-400/40 font-mono">
        Vérifiez avant de valider le déploiement ETL.
      </p>
    </motion.div>
  );
}
