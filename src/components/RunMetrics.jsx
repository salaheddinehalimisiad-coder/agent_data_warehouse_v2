// src/components/RunMetrics.jsx — Dashboard métriques v6.0 (D3 bars + grade multi-facteurs)
import { useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import {
  BarChart3, CheckCircle2, Database, Clock, Layers,
  Download, AlertTriangle, Activity,
} from 'lucide-react';
import { usePipelineStore } from '../store/pipelineStore';
import HealHistory from './HealHistory';
import ExecutiveSummary from './ExecutiveSummary';

// ─── D3 Performance Chart — barres verticales côte à côte ────────────────────
function D3PerfChart({ durations }) {
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!wrapRef.current || !svgRef.current) return;
    const entries = Object.entries(durations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14);
    if (!entries.length) return;

    const draw = () => {
      const W = wrapRef.current.offsetWidth || 600;
      const H = 270;
      const m = { top: 22, right: 20, bottom: 72, left: 48 };
      const iW = W - m.left - m.right;
      const iH = H - m.top - m.bottom;

      d3.select(svgRef.current).selectAll('*').remove();
      const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);

      // Dégradés par barre
      const defs = svg.append('defs');
      entries.forEach((_, i) => {
        const top3 = i < 3;
        const gr = defs.append('linearGradient')
          .attr('id', `pg-${i}`)
          .attr('x1', '0%').attr('x2', '0%')
          .attr('y1', '0%').attr('y2', '100%');
        gr.append('stop').attr('offset', '0%')
          .attr('stop-color', top3 ? '#f59e0b' : '#6366f1').attr('stop-opacity', 1);
        gr.append('stop').attr('offset', '100%')
          .attr('stop-color', top3 ? '#92400e' : '#312e81').attr('stop-opacity', 0.55);
      });

      const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

      const xScale = d3.scaleBand()
        .domain(entries.map(d => d[0]))
        .range([0, iW]).padding(0.28);

      const yMax = d3.max(entries, d => d[1]) || 1;
      const yScale = d3.scaleLinear()
        .domain([0, yMax * 1.15]).range([iH, 0]);

      // Lignes de grille
      g.append('g')
        .call(d3.axisLeft(yScale).tickSize(-iW).tickFormat('').ticks(5))
        .call(a => {
          a.select('.domain').remove();
          a.selectAll('.tick line')
            .attr('stroke', 'rgba(255,255,255,0.04)')
            .attr('stroke-dasharray', '4,4');
        });

      // Axe Y
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}s`))
        .call(a => {
          a.select('.domain').attr('stroke', 'rgba(255,255,255,0.08)');
          a.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.06)');
          a.selectAll('.tick text')
            .attr('fill', '#64748b').attr('font-size', '9px').attr('font-family', 'monospace');
        });

      // Axe X
      g.append('g')
        .attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(xScale).tickFormat(d => d.replace(/_/g, ' ')))
        .call(a => {
          a.select('.domain').attr('stroke', 'rgba(255,255,255,0.08)');
          a.selectAll('.tick line').remove();
          a.selectAll('.tick text')
            .attr('fill', '#64748b').attr('font-size', '8px').attr('font-family', 'monospace')
            .style('text-anchor', 'end')
            .attr('dx', '-0.4em').attr('dy', '0.1em')
            .attr('transform', 'rotate(-38)');
        });

      // Tooltip — remove existing to prevent duplication on redraw
      d3.select(wrapRef.current).selectAll('.chart-tooltip').remove();
      const tt = d3.select(wrapRef.current)
        .append('div')
        .attr('class', 'chart-tooltip')
        .style('position', 'absolute')
        .style('background', '#0f172a')
        .style('border', '1px solid rgba(255,255,255,0.1)')
        .style('color', '#e2e8f0')
        .style('padding', '6px 10px')
        .style('border-radius', '8px')
        .style('font-size', '10px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 10);

      // Barres
      g.selectAll('.bar')
        .data(entries)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d[0]))
        .attr('width', xScale.bandwidth())
        .attr('y', iH).attr('height', 0)
        .attr('rx', 5)
        .attr('fill', (_, i) => `url(#pg-${i})`)
        .attr('opacity', 0.85)
        .on('mouseover', function (event, d) {
          d3.select(this).attr('opacity', 1).style('filter', 'brightness(1.25)');
          tt.style('opacity', 1)
            .html(`<strong>${d[0].replace(/_/g, ' ')}</strong><br/>${d[1]}s`)
            .style('left', `${event.offsetX + 12}px`)
            .style('top', `${event.offsetY - 36}px`);
        })
        .on('mouseleave', function () {
          d3.select(this).attr('opacity', 0.85).style('filter', null);
          tt.style('opacity', 0);
        })
        .transition().duration(720).delay((_, i) => i * 55).ease(d3.easeCubicOut)
        .attr('y', d => yScale(d[1]))
        .attr('height', d => iH - yScale(d[1]));

      // Valeurs au-dessus
      g.selectAll('.vlabel')
        .data(entries)
        .join('text')
        .attr('class', 'vlabel')
        .attr('x', d => xScale(d[0]) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d[1]) - 5)
        .attr('text-anchor', 'middle')
        .attr('fill', (_, i) => i < 3 ? '#fbbf24' : '#818cf8')
        .attr('font-size', '9px').attr('font-weight', 'bold').attr('font-family', 'monospace')
        .attr('opacity', 0)
        .text(d => `${d[1]}s`)
        .transition().delay((_, i) => 700 + i * 55)
        .attr('opacity', 1);

      // Ligne de référence moyenne
      const avg = d3.mean(entries, d => d[1]) || 0;
      g.append('line')
        .attr('x1', 0).attr('x2', iW)
        .attr('y1', yScale(avg)).attr('y2', yScale(avg))
        .attr('stroke', 'rgba(99,102,241,0.35)')
        .attr('stroke-dasharray', '5,5')
        .attr('stroke-width', 1.5);
      g.append('text')
        .attr('x', iW - 4).attr('y', yScale(avg) - 5)
        .attr('text-anchor', 'end')
        .attr('fill', '#6366f1').attr('font-size', '8px').attr('font-family', 'monospace')
        .text(`moy ${avg.toFixed(1)}s`);

    };

    // Initial draw
    draw();

    // Setup ResizeObserver once, outside draw()
    const ro = new ResizeObserver(() => {
      if (wrapRef.current) draw();
    });
    ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
      d3.select(wrapRef.current).selectAll('div').remove();
    };
  }, [durations]);

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden">
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}

// ─── Load Ring ────────────────────────────────────────────────────────────────
function LoadRing({ rate }) {
  const r    = 38;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, rate) / 100) * circ;
  const color = rate >= 90 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
        <motion.circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 50 50)"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-black text-white">{rate}%</div>
        <div className="text-[8px] text-slate-500 uppercase tracking-widest font-black">Taux de Chargement</div>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = 'default' }) {
  const colors = {
    default: 'border-white/[0.06] bg-white/[0.02]',
    success: 'border-emerald-500/20 bg-emerald-500/[0.04]',
    warn:    'border-amber-500/20  bg-amber-500/[0.04]',
    error:   'border-rose-500/20   bg-rose-500/[0.04]',
    info:    'border-indigo-500/20 bg-indigo-500/[0.04]',
  };
  const textColors = {
    default: 'text-white', success: 'text-emerald-400',
    warn: 'text-amber-400', error: 'text-rose-400', info: 'text-indigo-400',
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <div className={`text-3xl font-black tracking-tighter mb-1 ${textColors[color]}`}>{value}</div>
      <div className="text-[11px] font-bold text-white uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

// ─── D3 Load Donut ─────────────────────────────────────────────────────────
function D3LoadDonut({ inserted, rejected, existing, updated }) {
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current) return;

    const segments = [
      { label: 'Insérés',  value: inserted || 0, color: '#10b981' },
      { label: 'Existants',value: existing  || 0, color: '#6366f1' },
      { label: 'SCD2',     value: updated   || 0, color: '#f59e0b' },
      { label: 'Rejetés',  value: rejected  || 0, color: '#ef4444' },
    ].filter(s => s.value > 0);

    if (!segments.length) return;

    const total = segments.reduce((s, d) => s + d.value, 0);
    const W = wrapRef.current.offsetWidth || 300;
    const H = 180;
    const R = Math.min(W / 2, H / 2) - 12;
    const innerR = R * 0.58;

    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);

    const pie = d3.pie().value(d => d.value).sort(null).padAngle(0.025);
    const arc = d3.arc().innerRadius(innerR).outerRadius(R).cornerRadius(4);
    const arcH = d3.arc().innerRadius(innerR).outerRadius(R + 7).cornerRadius(4);

    const g = svg.append('g').attr('transform', `translate(${W * 0.38},${H / 2})`);

    const paths = g.selectAll('.arc')
      .data(pie(segments))
      .join('path')
      .attr('fill', d => d.data.color)
      .attr('opacity', 0.88)
      .on('mouseover', function (_, d) {
        d3.select(this).attr('d', arcH(d)).attr('opacity', 1);
      })
      .on('mouseleave', function (_, d) {
        d3.select(this).attr('d', arc(d)).attr('opacity', 0.88);
      });

    paths.transition().duration(600).delay((_, i) => i * 80)
      .attrTween('d', function (d) {
        const interp = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
        return t => arc(interp(t));
      });

    // Centre
    g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.3em')
      .attr('fill', '#f1f5f9').attr('font-size', '18px').attr('font-weight', 'bold').attr('font-family', 'monospace')
      .text(total.toLocaleString());
    g.append('text').attr('text-anchor', 'middle').attr('dy', '1.1em')
      .attr('fill', '#64748b').attr('font-size', '8px').attr('font-family', 'monospace')
      .text('total lignes');

    // Legend
    const leg = svg.append('g')
      .attr('transform', `translate(${W * 0.68},${H / 2 - (segments.length * 16) / 2})`);

    segments.forEach((s, i) => {
      const row = leg.append('g').attr('transform', `translate(0,${i * 16})`);
      row.append('rect').attr('width', 9).attr('height', 9).attr('rx', 2).attr('fill', s.color);
      row.append('text').attr('x', 14).attr('y', 8.5)
        .attr('fill', '#94a3b8').attr('font-size', '8.5px').attr('font-family', 'monospace')
        .text(`${s.label} (${Math.round(s.value / total * 100)}%)`);
    });

    const ro = new ResizeObserver(() => d3.select(svgRef.current).selectAll('*').remove());
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [inserted, rejected, existing, updated]);

  return <div ref={wrapRef} className="w-full"><svg ref={svgRef} className="w-full" /></div>;
}

// ─── D3 Grouped Bar Chart (Dimensions) ───────────────────────────────────────
function D3DimGroupedBar({ dimMetrics }) {
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current) return;
    const entries = Object.entries(dimMetrics).slice(0, 10);
    if (!entries.length) return;

    const draw = () => {
      const data = entries.map(([name, m]) => ({
        name:     name.replace(/^[a-z]+_/, '').substring(0, 12),
        inserted: m?.inserted || 0,
        updated:  m?.updated  || 0,
        existing: m?.existing || 0,
      }));

      const CATS = [
        { key: 'inserted', color: '#10b981', label: 'Nouveaux' },
        { key: 'updated',  color: '#f59e0b', label: 'SCD2'     },
        { key: 'existing', color: '#6366f1', label: 'Existants'},
      ];

      const W = wrapRef.current.offsetWidth || 600;
      const H = 220;
      const m = { top: 16, right: 16, bottom: 60, left: 44 };
      const iW = W - m.left - m.right;
      const iH = H - m.top - m.bottom;

      d3.select(svgRef.current).selectAll('*').remove();
      const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);
      const g   = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

      const x0 = d3.scaleBand().domain(data.map(d => d.name)).range([0, iW]).padding(0.28);
      const x1 = d3.scaleBand().domain(CATS.map(c => c.key)).range([0, x0.bandwidth()]).padding(0.1);
      const yMax = d3.max(data, d => Math.max(d.inserted, d.updated, d.existing)) || 1;
      const y  = d3.scaleLinear().domain([0, yMax * 1.12]).range([iH, 0]);

      // Gridlines
      g.append('g')
        .call(d3.axisLeft(y).tickSize(-iW).tickFormat('').ticks(4))
        .call(a => { a.select('.domain').remove(); a.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.04)').attr('stroke-dasharray', '3,3'); });

      // Y axis
      g.append('g')
        .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('.2s')))
        .call(a => {
          a.select('.domain').attr('stroke', 'rgba(255,255,255,0.08)');
          a.selectAll('.tick line').remove();
          a.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', '8px').attr('font-family', 'monospace');
        });

      // X axis
      g.append('g')
        .attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(x0))
        .call(a => {
          a.select('.domain').attr('stroke', 'rgba(255,255,255,0.06)');
          a.selectAll('.tick line').remove();
          a.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', '8px').attr('font-family', 'monospace')
            .style('text-anchor', 'end').attr('dx', '-0.4em').attr('dy', '0.1em').attr('transform', 'rotate(-32)');
        });

      // Grouped bars
      const groups = g.selectAll('.grp')
        .data(data).join('g').attr('class', 'grp')
        .attr('transform', d => `translate(${x0(d.name)},0)`);

      CATS.forEach(cat => {
        groups.append('rect')
          .attr('x', x1(cat.key))
          .attr('width', x1.bandwidth())
          .attr('y', iH).attr('height', 0).attr('rx', 3)
          .attr('fill', cat.color).attr('opacity', 0.85)
          .on('mouseover', function () { d3.select(this).attr('opacity', 1).style('filter', 'brightness(1.2)'); })
          .on('mouseleave', function () { d3.select(this).attr('opacity', 0.85).style('filter', null); })
          .transition().duration(650).delay((_, i) => i * 40).ease(d3.easeCubicOut)
          .attr('y', d => y(d[cat.key]))
          .attr('height', d => iH - y(d[cat.key]));
      });

      // Legend
      const legG = svg.append('g').attr('transform', `translate(${m.left},${H - 14})`);
      CATS.forEach((cat, i) => {
        const lx = i * (iW / 3);
        legG.append('rect').attr('x', lx).attr('width', 8).attr('height', 8).attr('rx', 2).attr('fill', cat.color);
        legG.append('text').attr('x', lx + 12).attr('y', 8)
          .attr('fill', '#64748b').attr('font-size', '8px').attr('font-family', 'monospace')
          .text(cat.label);
      });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [dimMetrics]);

  return <div ref={wrapRef} className="w-full"><svg ref={svgRef} className="w-full" /></div>;
}

// ─── Fact Card ────────────────────────────────────────────────────────────────
function FactCard({ factName, metrics }) {
  const ins  = metrics?.inserted || 0;
  const rej  = metrics?.rejected || 0;
  const tot  = ins + rej;
  const rate = tot > 0 ? Math.round((ins / tot) * 100) : 0;
  const col  = rate >= 90 ? 'emerald' : rate >= 70 ? 'amber' : 'rose';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className={`rounded-2xl border border-${col}-500/20 bg-${col}-500/[0.04] p-4 space-y-2`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={12} className={`text-${col}-400`} />
          <span className="text-[11px] font-black text-white uppercase tracking-wider truncate">
            {factName.replace('fact_', '').replace(/_/g, ' ')}
          </span>
        </div>
        <span className={`text-[10px] font-black text-${col}-400 bg-${col}-500/10 px-2 py-0.5 rounded-full`}>
          {rate}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <div className="text-lg font-black text-emerald-400">{ins.toLocaleString()}</div>
          <div className="text-[8px] font-bold text-slate-500 uppercase">Insérés</div>
        </div>
        <div>
          <div className={`text-lg font-black ${rej > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
            {rej.toLocaleString()}
          </div>
          <div className="text-[8px] font-bold text-slate-500 uppercase">Rejetés</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Grade multi-facteurs ─────────────────────────────────────────────────────
// LoadRate (max 8) + DQ Score (max 8) + Structure (max 4) = 20
function grade(loadRate, rejected, dqScore, dimCount) {
  let pts = 0;

  // Factor 1 – Load rate (max 8 pts)
  if      (loadRate >= 99 && rejected === 0) pts += 8;
  else if (loadRate >= 95) pts += 7;
  else if (loadRate >= 90) pts += 7;
  else if (loadRate >= 80) pts += 6;
  else if (loadRate >= 70) pts += 6;
  else if (loadRate >= 60) pts += 5;
  else    pts += Math.max(0, Math.round(loadRate / 12));

  // Factor 2 – DQ score (max 8 pts)
  const dq = Math.min(100, Math.max(0, dqScore ?? 75));
  pts += Math.round((dq / 100) * 8);

  // Factor 3 – Structure (max 4 pts)
  if (rejected === 0) pts += 2;
  else if (rejected < 10) pts += 1;
  if ((dimCount || 0) >= 3) pts += 2;
  else if ((dimCount || 0) >= 1) pts += 1;

  const score = Math.min(20, Math.max(0, pts));
  const color = score >= 16 ? 'text-emerald-400' : score >= 13 ? 'text-indigo-400' : score >= 9 ? 'text-amber-400' : 'text-rose-400';
  const bg    = score >= 16 ? 'bg-emerald-500/10 border-emerald-500/30' : score >= 13 ? 'bg-indigo-500/10 border-indigo-500/30' : score >= 9 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-rose-500/10 border-rose-500/30';
  const label = score >= 16 ? 'Excellent' : score >= 13 ? 'Bon' : score >= 9 ? 'Acceptable' : 'À améliorer';
  return { g: `${score}/20`, score, color, bg, label };
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function RunMetrics() {
  const {
    loadMetrics, etlProgress, executiveSummary, visualizations,
    etlStatus, pipelineStatus, sessionId, userPrefix, nodeDurations,
    dqScore,
  } = usePipelineStore();

  const factsMap    = loadMetrics?.facts || {};
  const factEntries = Object.entries(factsMap);
  const isConst     = factEntries.length > 1;

  const factMetrics = useMemo(() => {
    if (factEntries.length > 0) return factsMap;
    const legacy = loadMetrics?.fact;
    if (legacy?.inserted !== undefined) return { default: legacy };
    return {};
  }, [loadMetrics, factsMap, factEntries.length]);

  const dimMetrics  = loadMetrics?.dimensions || {};
  const sourceRows  = loadMetrics?.source_rows || 0;
  const loadedAt    = loadMetrics?.loaded_at;
  const dimCount    = Object.keys(dimMetrics).length;

  const totalInserted = useMemo(() =>
    Object.values(factMetrics).reduce((s, m) => s + (m?.inserted || 0), 0), [factMetrics]);
  const totalRejected = useMemo(() =>
    Object.values(factMetrics).reduce((s, m) => s + (m?.rejected || 0), 0), [factMetrics]);
  const loadRate = sourceRows > 0 ? Math.round((totalInserted / sourceRows) * 100) : 0;

  const loadTimeStr = useMemo(() => {
    if (!loadedAt) return null;
    return new Date(loadedAt).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }, [loadedAt]);

  const runGrade = grade(loadRate, totalRejected, dqScore, dimCount);

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify({
      session_id: sessionId, prefix: userPrefix,
      generated_at: new Date().toISOString(),
      load_rate_pct: loadRate, grade: runGrade.g,
      source_rows: sourceRows, facts: factMetrics,
      facts_inserted: totalInserted, facts_rejected: totalRejected,
      loaded_at: loadedAt, dimensions: dimMetrics,
      dq_score: dqScore, is_constellation: isConst,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run_metrics_${sessionId?.substring(0, 8) || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!loadMetrics && !etlProgress) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
        <BarChart3 size={32} className="text-slate-600" />
        <div className="text-center">
          <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Métriques non disponibles</p>
          <p className="text-[10px] text-slate-600 mt-1">Apparaissent après un chargement DW réel</p>
        </div>
      </div>
    );
  }

  if (etlProgress && (!loadMetrics || pipelineStatus === 'running')) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 bg-black/40">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-2">
              <Database size={24} className="animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">Synthèse en Cours</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Actif : {etlProgress.table}</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>{etlProgress.inserted} rows</span>
              <span>{etlProgress.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 border border-white/5 overflow-hidden p-0.5">
              <motion.div initial={{ width: 0 }} animate={{ width: `${etlProgress.pct}%` }}
                className="h-full rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
              <div className="text-xl font-black text-white">{etlProgress.inserted}</div>
              <div className="text-[8px] font-bold text-slate-500 uppercase">Insérés</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
              <div className={`text-xl font-black ${etlProgress.rejected > 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                {etlProgress.rejected}
              </div>
              <div className="text-[8px] font-bold text-slate-500 uppercase">Rejetés</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <BarChart3 size={15} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-[13px] font-black text-white">
              Métriques de chargement
              {isConst && (
                <span className="ml-2 text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  ★ Constellation
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-500">{loadTimeStr || 'Dernier run ETL'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${runGrade.bg} ${runGrade.color}`}>
            {runGrade.g} · {runGrade.label}
          </span>
          <button
            onClick={handleDownload}
            className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
            title="Télécharger le rapport JSON"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        <HealHistory />

        {/* KPIs */}
        <div className="flex gap-4 items-center">
          <LoadRing rate={loadRate} />

          {/* Grade Halo */}
          <div className="relative group mx-2">
            <div className={`absolute inset-0 blur-3xl opacity-20 transition-all duration-1000 rounded-full ${runGrade.color.replace('text-', 'bg-')}`} />
            <div className={`relative w-20 h-20 rounded-2xl border flex flex-col items-center justify-center bg-black/40 backdrop-blur-xl shadow-2xl ${runGrade.bg}`}>
              <span className={`text-2xl font-black italic tracking-tighter ${runGrade.color}`}>{runGrade.g}</span>
              <span className="text-[7px] font-black uppercase text-slate-500 tracking-widest mt-0.5">{runGrade.label}</span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-2">
            <MetricCard label="Lignes source"  value={sourceRows.toLocaleString()}    color="info" />
            <MetricCard label="Faits insérés"  value={totalInserted.toLocaleString()} color="success" />
            <MetricCard label="Rejetées"
              value={totalRejected.toLocaleString()}
              sub={totalRejected > 0 ? 'Quarantaine' : 'Aucune'}
              color={totalRejected === 0 ? 'default' : 'error'}
            />
            <MetricCard label={isConst ? 'Facts / Dims' : 'Dimensions'}
              value={isConst ? `${factEntries.length}F / ${dimCount}D` : dimCount}
              color="info"
            />
          </div>
        </div>

        {/* Score DQ en bandeau */}
        {dqScore != null && (
          <div className={`flex items-center gap-4 rounded-2xl border p-4 ${
            dqScore >= 90 ? 'border-emerald-500/20 bg-emerald-500/[0.04]' :
            dqScore >= 70 ? 'border-amber-500/20  bg-amber-500/[0.04]'  :
                            'border-rose-500/20   bg-rose-500/[0.04]'
          }`}>
            <div className="text-center shrink-0">
              <div className={`text-3xl font-black ${
                dqScore >= 90 ? 'text-emerald-400' : dqScore >= 70 ? 'text-amber-400' : 'text-rose-400'
              }`}>{dqScore}</div>
              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Score DQ</div>
            </div>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${dqScore}%` }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    dqScore >= 90 ? 'bg-emerald-500' : dqScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                />
              </div>
              <div className="flex justify-between text-[8px] text-slate-600 mt-1 font-mono">
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 shrink-0">
              Qualité contribue<br/>
              <span className="font-black text-indigo-400">{Math.round((dqScore / 100) * 6)}/6 pts</span> à la note
            </div>
          </div>
        )}

        {/* Multi-Fact Cards */}
        {factEntries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-indigo-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {isConst ? 'Constellation — Tables de Faits' : 'Table de Faits'}
              </span>
            </div>
            <div className={`grid ${isConst ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-3`}>
              {factEntries.map(([name, m]) => (
                <FactCard key={name} factName={name} metrics={m} />
              ))}
            </div>
          </div>
        )}

        {/* Quarantine alert */}
        {totalRejected > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-rose-400" />
              <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider">
                Quarantaine — {totalRejected} ligne(s) redirigée(s)
              </span>
            </div>
            <p className="text-[12px] text-slate-300 leading-relaxed">
              Lignes rejetées sauvegardées dans <span className="font-mono text-rose-300">rejets_fact_*</span> avec motif d'erreur.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {factEntries.filter(([, m]) => (m?.rejected || 0) > 0).map(([name, m]) => (
                <div key={name} className="flex items-center justify-between bg-black/30 rounded-xl px-3 py-2 border border-white/5">
                  <span className="text-[10px] font-mono text-slate-400 truncate">{name}</span>
                  <span className="text-[10px] font-black text-rose-400">{m.rejected} rej.</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══ Load Breakdown Donut ══════════════════════════════════════════ */}
        {(totalInserted > 0 || totalRejected > 0) && (
          <div className="rounded-[28px] border border-white/[0.05] bg-white/[0.02] p-6 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Répartition des lignes chargées</span>
            </div>
            <D3LoadDonut
              inserted={totalInserted}
              rejected={totalRejected}
              existing={Object.values(factMetrics).reduce((s, m) => s + (m?.existing || 0), 0)}
              updated={Object.values(factMetrics).reduce((s, m) => s + (m?.updated || 0), 0)}
            />
          </div>
        )}

        {/* Neural Dashboard */}
        {visualizations.length > 0 && (
          <ExecutiveSummary content={executiveSummary} visualizations={visualizations} />
        )}

        {/* ═══ Agent Performance Profiler — D3 bars côte à côte ══════════════ */}
        {Object.keys(nodeDurations).length > 0 && (
          <div className="rounded-[32px] p-8 border border-white/[0.05] bg-white/[0.02] space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Clock size={20} className="text-amber-400" />
                </div>
                <div>
                  <h4 className="text-[12px] font-black tracking-widest text-white uppercase italic">Profileur de Performance Agent</h4>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Durée d'exécution par nœud (secondes)</p>
                </div>
              </div>
              <div className="text-[10px] font-mono text-zinc-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                Total : {Object.values(nodeDurations).reduce((a, b) => a + b, 0).toFixed(2)}s
              </div>
            </div>

            {/* D3 Chart */}
            <D3PerfChart durations={nodeDurations} />

            {/* Légende rapide top 3 */}
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.entries(nodeDurations)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([node, dur], i) => (
                  <span key={node} className="flex items-center gap-1.5 text-[9px] font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                    <span className="text-amber-400 font-black">#{i + 1}</span>
                    <span className="text-slate-400">{node.replace(/_/g, ' ')}</span>
                    <span className="text-amber-400 font-bold">{dur}s</span>
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* ═══ Dimensions — D3 Grouped Bar Chart ══════════════════════════════ */}
        {Object.keys(dimMetrics).length > 0 && (
          <div className="rounded-[28px] border border-white/[0.05] bg-white/[0.02] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Layers size={12} className="text-indigo-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Dimensions chargées {isConst && '· conformées'}
              </span>
              <span className="ml-auto text-[9px] font-bold text-slate-600 bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.05]">
                {Object.keys(dimMetrics).length} tables
              </span>
            </div>
            <D3DimGroupedBar dimMetrics={dimMetrics} />
          </div>
        )}

        {/* Évaluation */}
        <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={12} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Évaluation du run</span>
          </div>

          {/* Décomposition de la note */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Load Rate', pts: runGrade.score >= 5 ? (loadRate >= 90 ? '8-10' : loadRate >= 70 ? '6-7' : '5') : '<5', max: '10', pct: loadRate },
              { label: 'DQ Score',  pts: `${Math.round(((dqScore ?? 75) / 100) * 6)}`, max: '6',  pct: dqScore ?? 75 },
              { label: 'Structure', pts: `${(totalRejected === 0 ? 2 : 1) + (dimCount >= 3 ? 2 : dimCount >= 1 ? 1 : 0)}`, max: '4', pct: dimCount >= 3 ? 100 : dimCount >= 1 ? 50 : 0 },
            ].map(({ label, pts, max, pct }) => (
              <div key={label} className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</div>
                <div className="text-[16px] font-black text-white">{pts}<span className="text-[9px] text-slate-600">/{max}</span></div>
                <div className="mt-1.5 h-1 rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {[
              { ok: loadRate >= 90, text: loadRate >= 90 ? `Load rate excellent (${loadRate}%)` : `Load rate (${loadRate}%) — vérifier les rejets` },
              { ok: totalRejected === 0, text: totalRejected === 0 ? 'Aucun rejet — données propres' : `${totalRejected} ligne(s) rejetée(s) → tables quarantaine` },
              { ok: dimCount > 0, text: dimCount > 0 ? `${dimCount} dimension(s) chargée(s)` : 'Aucune dimension chargée' },
              ...(isConst ? [{ ok: true, text: `Constellation : ${factEntries.length} tables de faits indépendantes` }] : []),
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${item.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-[12px] text-slate-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
