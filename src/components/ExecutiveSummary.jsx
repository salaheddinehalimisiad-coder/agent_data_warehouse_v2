// src/components/ExecutiveSummary.jsx — D3.js charts v2.0
import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import {
  Sparkles, Terminal, ShieldCheck, Target, Lightbulb,
  Copy, Check, BarChart3, PieChart, TrendingUp,
} from 'lucide-react';

// ─── D3 Bar Chart ─────────────────────────────────────────────────────────────
function D3BarChart({ title, data }) {
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);

  const keys = data && data.length > 0 ? Object.keys(data[0]) : [];
  const yKey = keys.find(k =>
    typeof data[0][k] === 'number' &&
    !['id', 'sk', 'pk'].some(s => k.toLowerCase().includes(s))
  );
  const xKey = keys.find(k => k !== yKey) || keys[0];

  useEffect(() => {
    if (!wrapRef.current || !svgRef.current || !yKey || !data?.length) return;

    const draw = () => {
      const rows = data.slice(0, 12);
      const W = wrapRef.current.offsetWidth || 500;
      const H = 200;
      const m = { top: 18, right: 16, bottom: 52, left: 44 };
      const iW = W - m.left - m.right;
      const iH = H - m.top - m.bottom;

      d3.select(svgRef.current).selectAll('*').remove();
      const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);

      // Gradients
      const defs = svg.append('defs');
      rows.forEach((_, i) => {
        const gr = defs.append('linearGradient')
          .attr('id', `bar-es-${i}`)
          .attr('x1', '0%').attr('x2', '0%').attr('y1', '0%').attr('y2', '100%');
        gr.append('stop').attr('offset', '0%')
          .attr('stop-color', i % 2 === 0 ? '#818cf8' : '#6366f1').attr('stop-opacity', 1);
        gr.append('stop').attr('offset', '100%')
          .attr('stop-color', i % 2 === 0 ? '#312e81' : '#1e1b4b').attr('stop-opacity', 0.5);
      });

      const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

      const xScale = d3.scaleBand()
        .domain(rows.map(d => String(d[xKey]).substring(0, 10)))
        .range([0, iW]).padding(0.25);

      const yMax = d3.max(rows, d => d[yKey]) || 1;
      const yScale = d3.scaleLinear().domain([0, yMax * 1.12]).range([iH, 0]);

      // Gridlines
      g.append('g')
        .call(d3.axisLeft(yScale).tickSize(-iW).tickFormat('').ticks(4))
        .call(a => {
          a.select('.domain').remove();
          a.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.05)').attr('stroke-dasharray', '3,3');
        });

      // Y axis
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(4).tickFormat(d3.format('.2s')))
        .call(a => {
          a.select('.domain').attr('stroke', 'rgba(255,255,255,0.08)');
          a.selectAll('.tick line').remove();
          a.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', '8px').attr('font-family', 'monospace');
        });

      // X axis
      g.append('g')
        .attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(xScale))
        .call(a => {
          a.select('.domain').attr('stroke', 'rgba(255,255,255,0.06)');
          a.selectAll('.tick line').remove();
          a.selectAll('.tick text')
            .attr('fill', '#64748b').attr('font-size', '7px').attr('font-family', 'monospace')
            .style('text-anchor', 'end')
            .attr('dx', '-0.4em').attr('dy', '0.1em')
            .attr('transform', 'rotate(-35)');
        });

      // Bars
      g.selectAll('.bar')
        .data(rows)
        .join('rect')
        .attr('x', d => xScale(String(d[xKey]).substring(0, 10)))
        .attr('width', xScale.bandwidth())
        .attr('y', iH).attr('height', 0).attr('rx', 4)
        .attr('fill', (_, i) => `url(#bar-es-${i})`)
        .attr('opacity', 0.88)
        .on('mouseover', function () { d3.select(this).style('filter', 'brightness(1.3)'); })
        .on('mouseleave', function () { d3.select(this).style('filter', null); })
        .transition().duration(650).delay((_, i) => i * 50).ease(d3.easeCubicOut)
        .attr('y', d => yScale(d[yKey]))
        .attr('height', d => iH - yScale(d[yKey]));

      // Value labels
      g.selectAll('.vlbl')
        .data(rows)
        .join('text')
        .attr('x', d => xScale(String(d[xKey]).substring(0, 10)) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d[yKey]) - 4)
        .attr('text-anchor', 'middle')
        .attr('fill', '#a5b4fc').attr('font-size', '8px').attr('font-weight', 'bold').attr('font-family', 'monospace')
        .attr('opacity', 0)
        .text(d => d3.format('.2s')(d[yKey]))
        .transition().delay((_, i) => 600 + i * 50).attr('opacity', 1);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [data, yKey, xKey]);

  if (!yKey) return null;

  return (
    <div className="bg-black/40 rounded-3xl border border-white/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={11} className="text-indigo-400" />
        <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">{title}</h5>
      </div>
      <div ref={wrapRef} className="w-full">
        <svg ref={svgRef} className="w-full" />
      </div>
    </div>
  );
}

// ─── D3 Line Chart ────────────────────────────────────────────────────────────
function D3LineChart({ title, data }) {
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);

  const keys = data && data.length > 0 ? Object.keys(data[0]) : [];
  const yKey = keys.find(k =>
    typeof data[0][k] === 'number' &&
    !['id', 'sk', 'pk'].some(s => k.toLowerCase().includes(s))
  );
  const xKey = keys.find(k => k !== yKey) || keys[0];

  useEffect(() => {
    if (!wrapRef.current || !svgRef.current || !yKey || !data?.length) return;

    const draw = () => {
      const rows = data.slice(0, 20);
      const W = wrapRef.current.offsetWidth || 500;
      const H = 200;
      const m = { top: 18, right: 16, bottom: 52, left: 44 };
      const iW = W - m.left - m.right;
      const iH = H - m.top - m.bottom;

      d3.select(svgRef.current).selectAll('*').remove();
      const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);

      const defs = svg.append('defs');
      const areaGrad = defs.append('linearGradient')
        .attr('id', 'area-grad').attr('x1', '0%').attr('x2', '0%').attr('y1', '0%').attr('y2', '100%');
      areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.35);
      areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.02);

      const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

      const xScale = d3.scalePoint()
        .domain(rows.map((_, i) => i))
        .range([0, iW]).padding(0.1);

      const yMax = d3.max(rows, d => d[yKey]) || 1;
      const yScale = d3.scaleLinear().domain([0, yMax * 1.12]).range([iH, 0]);

      // Gridlines
      g.append('g')
        .call(d3.axisLeft(yScale).tickSize(-iW).tickFormat('').ticks(4))
        .call(a => {
          a.select('.domain').remove();
          a.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.05)').attr('stroke-dasharray', '3,3');
        });

      // Y axis
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(4).tickFormat(d3.format('.2s')))
        .call(a => {
          a.select('.domain').attr('stroke', 'rgba(255,255,255,0.08)');
          a.selectAll('.tick line').remove();
          a.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', '8px').attr('font-family', 'monospace');
        });

      // X axis labels (first/last/middle)
      const xLabels = rows.map((d, i) => ({ i, label: String(d[xKey]).substring(0, 8) }))
        .filter((_, i, arr) => i === 0 || i === arr.length - 1 || i === Math.floor(arr.length / 2));
      g.append('g')
        .attr('transform', `translate(0,${iH})`)
        .selectAll('text')
        .data(xLabels)
        .join('text')
        .attr('x', d => xScale(d.i))
        .attr('y', 14)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b').attr('font-size', '8px').attr('font-family', 'monospace')
        .text(d => d.label);

      g.append('line').attr('x1', 0).attr('x2', iW).attr('y1', iH).attr('y2', iH)
        .attr('stroke', 'rgba(255,255,255,0.06)');

      // Area
      const area = d3.area()
        .x((_, i) => xScale(i))
        .y0(iH)
        .y1(d => yScale(d[yKey]))
        .curve(d3.curveCatmullRom);

      g.append('path')
        .datum(rows)
        .attr('fill', 'url(#area-grad)')
        .attr('d', area)
        .attr('opacity', 0)
        .transition().duration(800)
        .attr('opacity', 1);

      // Line
      const line = d3.line()
        .x((_, i) => xScale(i))
        .y(d => yScale(d[yKey]))
        .curve(d3.curveCatmullRom);

      const path = g.append('path')
        .datum(rows)
        .attr('fill', 'none')
        .attr('stroke', '#818cf8')
        .attr('stroke-width', 2)
        .attr('d', line);

      const totalLength = path.node().getTotalLength();
      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition().duration(1000).ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0);

      // Dots
      g.selectAll('.dot')
        .data(rows)
        .join('circle')
        .attr('cx', (_, i) => xScale(i))
        .attr('cy', d => yScale(d[yKey]))
        .attr('r', 0)
        .attr('fill', '#6366f1')
        .attr('stroke', '#818cf8')
        .attr('stroke-width', 1.5)
        .on('mouseover', function (event, d) {
          d3.select(this).attr('r', 5).attr('fill', '#a5b4fc');
        })
        .on('mouseleave', function () {
          d3.select(this).attr('r', 3).attr('fill', '#6366f1');
        })
        .transition().delay((_, i) => 800 + i * 40).duration(200)
        .attr('r', 3);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [data, yKey, xKey]);

  if (!yKey) return null;

  return (
    <div className="bg-black/40 rounded-3xl border border-white/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={11} className="text-indigo-400" />
        <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">{title}</h5>
      </div>
      <div ref={wrapRef} className="w-full">
        <svg ref={svgRef} className="w-full" />
      </div>
    </div>
  );
}

// ─── D3 Pie / Donut Chart ─────────────────────────────────────────────────────
function D3PieChart({ title, data }) {
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);

  const keys = data && data.length > 0 ? Object.keys(data[0]) : [];
  const yKey = keys.find(k =>
    typeof data[0][k] === 'number' &&
    !['id', 'sk', 'pk'].some(s => k.toLowerCase().includes(s))
  );
  const xKey = keys.find(k => k !== yKey) || keys[0];

  const COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#818cf8','#4f46e5','#7c3aed','#5b21b6'];

  useEffect(() => {
    if (!wrapRef.current || !svgRef.current || !yKey || !data?.length) return;

    const draw = () => {
      const rows = data.slice(0, 8);
      const W = wrapRef.current.offsetWidth || 300;
      const H = 200;
      const radius = Math.min(W, H) / 2 - 20;
      const innerR = radius * 0.55;

      d3.select(svgRef.current).selectAll('*').remove();
      const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);

      const chartG = svg.append('g')
        .attr('transform', `translate(${W * 0.38},${H / 2})`);

      const pie = d3.pie().value(d => d[yKey]).sort(null);
      const arc = d3.arc().innerRadius(innerR).outerRadius(radius).cornerRadius(4);
      const arcHover = d3.arc().innerRadius(innerR).outerRadius(radius + 6).cornerRadius(4);

      const arcs = chartG.selectAll('.arc')
        .data(pie(rows))
        .join('g').attr('class', 'arc');

      arcs.append('path')
        .attr('fill', (_, i) => COLORS[i % COLORS.length])
        .attr('opacity', 0.88)
        .attr('d', arc)
        .on('mouseover', function (event, d) {
          d3.select(this).attr('d', arcHover(d)).attr('opacity', 1);
        })
        .on('mouseleave', function (event, d) {
          d3.select(this).attr('d', arc(d)).attr('opacity', 0.88);
        })
        .transition().duration(600).delay((_, i) => i * 60)
        .attrTween('d', function (d) {
          const interp = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
          return t => arc(interp(t));
        });

      // Centre label
      const total = d3.sum(rows, d => d[yKey]);
      chartG.append('text').attr('text-anchor', 'middle').attr('dy', '-0.2em')
        .attr('fill', '#e2e8f0').attr('font-size', '16px').attr('font-weight', 'bold')
        .attr('font-family', 'monospace')
        .text(d3.format('.2s')(total));
      chartG.append('text').attr('text-anchor', 'middle').attr('dy', '1.1em')
        .attr('fill', '#64748b').attr('font-size', '8px').attr('font-family', 'monospace')
        .text('total');

      // Legend
      const legendG = svg.append('g')
        .attr('transform', `translate(${W * 0.65},${H / 2 - (rows.length * 14) / 2})`);

      rows.forEach((d, i) => {
        const row = legendG.append('g').attr('transform', `translate(0,${i * 14})`);
        row.append('rect').attr('width', 8).attr('height', 8).attr('rx', 2)
          .attr('fill', COLORS[i % COLORS.length]).attr('y', 0);
        row.append('text').attr('x', 12).attr('y', 8)
          .attr('fill', '#94a3b8').attr('font-size', '8px').attr('font-family', 'monospace')
          .text(String(d[xKey]).substring(0, 12));
      });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [data, yKey, xKey]);

  if (!yKey) return null;

  return (
    <div className="bg-black/40 rounded-3xl border border-white/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <PieChart size={11} className="text-indigo-400" />
        <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">{title}</h5>
      </div>
      <div ref={wrapRef} className="w-full">
        <svg ref={svgRef} className="w-full" />
      </div>
    </div>
  );
}

// ─── Chart Router ─────────────────────────────────────────────────────────────
function D3Chart({ type, title, data }) {
  if (!data || data.length === 0) return null;
  if (type === 'pie')  return <D3PieChart  title={title} data={data} />;
  if (type === 'line') return <D3LineChart title={title} data={data} />;
  return <D3BarChart title={title} data={data} />;
}

// ─── Executive Summary ────────────────────────────────────────────────────────
export default function ExecutiveSummary({ content, visualizations = [] }) {
  const [copied, setCopied] = React.useState(null);
  if (!content) return null;

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const sections = content.split('###').filter(s => s.trim());

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
          <Target size={20} className="text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white italic tracking-tighter uppercase leading-none">Neural Executive Storytelling</h3>
          <p className="text-[9px] text-indigo-500/60 font-bold uppercase tracking-[0.2em] mt-1">Strategic Dashboard · D3.js</p>
        </div>
      </div>

      {/* D3 Charts — grille 2 colonnes */}
      {visualizations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {visualizations.map((viz, i) => (
            <D3Chart key={i} {...viz} />
          ))}
        </div>
      )}

      {/* Sections texte */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, idx) => {
          const lines   = section.trim().split('\n');
          const title   = lines[0].trim();
          const body    = lines.slice(1).join('\n').trim();
          const isValue   = title.toLowerCase().includes('value');
          const isQueries = title.toLowerCase().includes('requêtes') || title.toLowerCase().includes('queries');
          const isHealth  = title.toLowerCase().includes('diagnostic') || title.toLowerCase().includes('health');

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className={`rounded-[32px] p-6 border relative overflow-hidden group ${
                isValue   ? 'bg-indigo-500/5  border-indigo-500/10 md:col-span-2' :
                isQueries ? 'bg-white/[0.02]  border-white/5       md:col-span-2' :
                            'bg-emerald-500/5 border-emerald-500/10'
              }`}
            >
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                {isValue ? <Lightbulb size={120} /> : isQueries ? <Terminal size={120} /> : <ShieldCheck size={120} />}
              </div>

              <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4">
                {isValue   && <Lightbulb   size={12} className="text-indigo-400" />}
                {isQueries && <Terminal    size={12} className="text-amber-400"  />}
                {isHealth  && <ShieldCheck size={12} className="text-emerald-400"/>}
                {title}
              </h4>

              <div className="relative z-10">
                {isQueries ? (
                  <div className="space-y-4">
                    {body.split('- **').filter(q => q.trim()).map((block, qIdx) => {
                      const [qTitle, qCodeRaw] = block.split('**:');
                      const qCode = qCodeRaw?.replace(/```sql|```/g, '').trim();
                      return (
                        <div key={qIdx} className="bg-black/40 rounded-2xl border border-white/5 p-4 hover:border-amber-500/30 transition-all">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-[11px] font-bold text-amber-200">🔍 {qTitle}</p>
                            <button
                              onClick={() => copyToClipboard(qCode, `q-${qIdx}`)}
                              className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-all"
                            >
                              {copied === `q-${qIdx}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                          <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">{qCode}</pre>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[13px] text-zinc-300 leading-relaxed font-medium whitespace-pre-wrap">{body}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
