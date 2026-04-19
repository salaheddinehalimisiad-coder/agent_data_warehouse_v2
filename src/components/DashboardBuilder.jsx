// src/components/DashboardBuilder.jsx — P3-06 : Dashboard Builder React
/**
 * Phase 3 — Composant générique pour visualiser les données du DW généré.
 * - Lit state.logical_model depuis le store Zustand
 * - Auto-suggest : visualisations basées sur le schéma
 * - Types de widgets : LineChart, BarChart, PieChart, KPI Card, DataTable
 * - Exécution de requêtes SQL via l'API
 * - Export PNG par widget
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePipelineStore } from '../store/pipelineStore';
import {
  BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon,
  Table2, Activity, Plus, Download, RefreshCw, Trash2, 
  GripVertical, Maximize2, X, Database, Sparkles, ChevronDown
} from 'lucide-react';

// ── Couleurs du thème ────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
  '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

const WIDGET_TYPES = [
  { id: 'kpi',   icon: Activity,       label: 'KPI Card' },
  { id: 'bar',   icon: BarChart3,       label: 'Bar Chart' },
  { id: 'line',  icon: LineChartIcon,   label: 'Line Chart' },
  { id: 'pie',   icon: PieChartIcon,    label: 'Pie Chart' },
  { id: 'table', icon: Table2,          label: 'Data Table' },
];

export default function DashboardBuilder() {
  const {
    logicalModel, queryResults, generatedQueries,
    userPrefix, sessionId, visualizations,
  } = usePipelineStore(s => ({
    logicalModel:     s.logicalModel,
    queryResults:     s.queryResults     || [],
    generatedQueries: s.generatedQueries || [],
    userPrefix:       s.userPrefix       || 'dw',
    sessionId:        s.sessionId,
    visualizations:   s.visualizations   || [],
  }));

  const [widgets, setWidgets] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState(null);
  const [loading, setLoading] = useState({});

  // ── Auto-populate d'après les query_results du pipeline ──────────────────
  useEffect(() => {
    if (widgets.length > 0) return;

    const autoWidgets = [];

    // D'abord, les visualizations du pipeline (insight_generator)
    if (visualizations.length > 0) {
      visualizations.forEach((viz, i) => {
        autoWidgets.push({
          id: `viz_${i}`,
          title: viz.title || `Visualisation ${i + 1}`,
          type: viz.type || 'bar',
          sql: viz.sql || '',
          data: viz.data || [],
          columns: viz.data?.length > 0 ? Object.keys(viz.data[0]) : [],
          error: viz.error || null,
        });
      });
    }

    // Ensuite, les query_results (query_generator)
    if (queryResults?.length > 0) {
      queryResults.forEach((qr, i) => {
        if (qr.error) return;
        autoWidgets.push({
          id: `qr_${i}`,
          title: qr.title || `Requête ${i + 1}`,
          type: _suggestWidgetType(qr),
          sql: qr.sql || '',
          data: _rowsToObjects(qr.columns, qr.rows),
          columns: qr.columns || [],
          error: null,
        });
      });
    }

    if (autoWidgets.length > 0) {
      setWidgets(autoWidgets);
    }
  }, [visualizations, queryResults]);

  // ── Génération automatique de suggestions ────────────────────────────────
  const suggestions = useMemo(() => {
    if (!logicalModel) return [];
    const sugs = [];

    const factTables = logicalModel.fact_tables || (logicalModel.fact_table ? [logicalModel.fact_table] : []);
    const dims = logicalModel.dimension_tables || [];
    const dimDate = dims.find(d => d.name === 'dim_date');
    const prefix = userPrefix;

    factTables.forEach(fact => {
      if (!fact) return;
      const metrics = fact.columns?.filter(c => c.role === 'metric') || [];
      const fks = fact.columns?.filter(c => c.role === 'fk') || [];

      if (metrics.length > 0) {
        sugs.push({
          title: `KPI — ${fact.name}`,
          type: 'kpi',
          sql: `SELECT COUNT(*) AS total_rows, ${metrics.slice(0, 3).map(m => `SUM([${m.name}]) AS total_${m.name}`).join(', ')} FROM [${prefix}_${fact.name}]`,
        });
      }

      if (dimDate && metrics.length > 0) {
        const dateSk = fks.find(f => f.references === 'dim_date')?.name || 'date_sk';
        sugs.push({
          title: `Tendance Mensuelle — ${fact.name}`,
          type: 'line',
          sql: `SELECT d.[year], d.[month], d.[month_name], SUM(f.[${metrics[0].name}]) AS total FROM [${prefix}_${fact.name}] f JOIN [${prefix}_dim_date] d ON f.[${dateSk}] = d.[date_sk] GROUP BY d.[year], d.[month], d.[month_name] ORDER BY d.[year], d.[month]`,
        });
      }

      fks.forEach(fk => {
        if (fk.references === 'dim_date') return;
        const dim = dims.find(d => d.name === fk.references);
        if (!dim || !metrics.length) return;
        const descCol = dim.columns?.find(c => 
          c.role === 'attribute' && !c.natural_key && 
          !['valid_from', 'valid_to', 'is_current'].includes(c.name) &&
          (c.type?.includes('VARCHAR') || c.type?.includes('NVARCHAR'))
        );
        if (!descCol) return;
        const pk = dim.columns?.find(c => c.role === 'pk')?.name || `${dim.name.replace('dim_', '')}_sk`;

        sugs.push({
          title: `Top 10 ${dim.name} — ${metrics[0].name}`,
          type: 'bar',
          sql: `SELECT TOP 10 dim.[${descCol.name}], SUM(f.[${metrics[0].name}]) AS total FROM [${prefix}_${fact.name}] f JOIN [${prefix}_${dim.name}] dim ON f.[${fk.name}] = dim.[${pk}] GROUP BY dim.[${descCol.name}] ORDER BY total DESC`,
        });
      });
    });

    return sugs;
  }, [logicalModel, userPrefix]);

  // ── Exécuter une requête ─────────────────────────────────────────────────
  const executeWidgetQuery = useCallback(async (widgetId, sql) => {
    setLoading(p => ({ ...p, [widgetId]: true }));
    try {
      const resp = await fetch(`/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ session_id: sessionId, sql }),
      });
      const data = await resp.json();
      if (data.success !== false) {
        setWidgets(prev => prev.map(w => w.id === widgetId ? {
          ...w,
          data: _rowsToObjects(data.columns, data.rows),
          columns: data.columns || [],
          error: null,
        } : w));
      } else {
        setWidgets(prev => prev.map(w => w.id === widgetId ? {
          ...w, error: data.error || 'Erreur inconnue'
        } : w));
      }
    } catch (err) {
      setWidgets(prev => prev.map(w => w.id === widgetId ? {
        ...w, error: err.message
      } : w));
    }
    setLoading(p => ({ ...p, [widgetId]: false }));
  }, [sessionId]);

  // ── Ajouter un widget ────────────────────────────────────────────────────
  const addWidget = (suggestion) => {
    const w = {
      id: `w_${Date.now()}`,
      title: suggestion.title,
      type: suggestion.type,
      sql: suggestion.sql,
      data: [],
      columns: [],
      error: null,
    };
    setWidgets(prev => [...prev, w]);
    setIsAddOpen(false);
    executeWidgetQuery(w.id, w.sql);
  };

  const removeWidget = (id) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  if (!logicalModel && queryResults.length === 0 && visualizations.length === 0) {
    return (
      <div style={styles.emptyState}>
        <Database size={48} style={{ color: '#6366f1', opacity: 0.5 }} />
        <h3 style={styles.emptyTitle}>Dashboard Builder</h3>
        <p style={styles.emptyText}>
          Lancez le pipeline pour générer un Data Warehouse.<br/>
          Les visualisations seront automatiquement proposées.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Sparkles size={20} style={{ color: '#6366f1' }} />
          <h2 style={styles.headerTitle}>Dashboard Builder</h2>
          <span style={styles.badge}>{widgets.length} widgets</span>
        </div>
        <div style={styles.headerActions}>
          <button 
            style={styles.addBtn}
            onClick={() => setIsAddOpen(!isAddOpen)}
          >
            <Plus size={16} />
            Ajouter un Widget
            <ChevronDown size={14} style={{ transform: isAddOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          </button>
        </div>
      </div>

      {/* ── Suggestions Dropdown ──────────────────────────────────────────── */}
      {isAddOpen && (
        <div style={styles.suggestionsPanel}>
          <div style={styles.suggestionsGrid}>
            {suggestions.map((sug, i) => {
              const TypeIcon = WIDGET_TYPES.find(t => t.id === sug.type)?.icon || BarChart3;
              return (
                <button 
                  key={i} 
                  style={styles.suggestionCard}
                  onClick={() => addWidget(sug)}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#2d2d35';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  }}
                >
                  <TypeIcon size={20} style={{ color: '#6366f1' }} />
                  <span style={styles.suggestionTitle}>{sug.title}</span>
                  <span style={styles.suggestionType}>{sug.type}</span>
                </button>
              );
            })}
            {suggestions.length === 0 && (
              <p style={styles.noSuggestions}>
                Aucune suggestion disponible. Le modèle logique est nécessaire.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Widgets Grid ─────────────────────────────────────────────────── */}
      <div style={styles.widgetsGrid}>
        {widgets.map(widget => (
          <WidgetCard
            key={widget.id}
            widget={widget}
            isLoading={loading[widget.id]}
            isExpanded={expandedWidget === widget.id}
            onExpand={() => setExpandedWidget(expandedWidget === widget.id ? null : widget.id)}
            onRefresh={() => executeWidgetQuery(widget.id, widget.sql)}
            onRemove={() => removeWidget(widget.id)}
          />
        ))}
      </div>

      {/* ── Expanded Widget Modal ─────────────────────────────────────────── */}
      {expandedWidget && (
        <div style={styles.modalOverlay} onClick={() => setExpandedWidget(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button style={styles.modalClose} onClick={() => setExpandedWidget(null)}>
              <X size={20} />
            </button>
            {(() => {
              const w = widgets.find(w => w.id === expandedWidget);
              return w ? <WidgetContent widget={w} expanded /> : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}


// ── Widget Card ──────────────────────────────────────────────────────────────
function WidgetCard({ widget, isLoading, isExpanded, onExpand, onRefresh, onRemove }) {
  const TypeIcon = WIDGET_TYPES.find(t => t.id === widget.type)?.icon || BarChart3;

  return (
    <div style={{
      ...styles.widgetCard,
      ...(isExpanded ? { gridColumn: 'span 2' } : {}),
    }}>
      <div style={styles.widgetHeader}>
        <div style={styles.widgetHeaderLeft}>
          <GripVertical size={14} style={{ color: '#52525b', cursor: 'grab' }} />
          <TypeIcon size={16} style={{ color: '#6366f1' }} />
          <span style={styles.widgetTitle}>{widget.title}</span>
        </div>
        <div style={styles.widgetActions}>
          <button style={styles.iconBtn} onClick={onRefresh} title="Rafraîchir">
            <RefreshCw size={14} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
          <button style={styles.iconBtn} onClick={onExpand} title="Agrandir">
            <Maximize2 size={14} />
          </button>
          <button style={styles.iconBtn} onClick={onRemove} title="Supprimer">
            <Trash2 size={14} style={{ color: '#ef4444' }} />
          </button>
        </div>
      </div>
      <div style={styles.widgetBody}>
        {isLoading ? (
          <div style={styles.loadingState}>
            <RefreshCw size={24} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
            <span>Exécution...</span>
          </div>
        ) : widget.error ? (
          <div style={styles.errorState}>
            <span style={styles.errorIcon}>⚠️</span>
            <span style={styles.errorText}>{widget.error}</span>
          </div>
        ) : (
          <WidgetContent widget={widget} />
        )}
      </div>
      {widget.sql && (
        <div style={styles.widgetFooter}>
          <code style={styles.sqlPreview}>{widget.sql.slice(0, 80)}...</code>
        </div>
      )}
    </div>
  );
}


// ── Widget Content Renderer ──────────────────────────────────────────────────
function WidgetContent({ widget, expanded = false }) {
  const data = widget.data || [];
  const columns = widget.columns || (data.length > 0 ? Object.keys(data[0]) : []);

  if (data.length === 0) {
    return (
      <div style={styles.emptyWidget}>
        <span>Pas de données</span>
      </div>
    );
  }

  switch (widget.type) {
    case 'kpi':
      return <KPIWidget data={data} columns={columns} />;
    case 'bar':
      return <BarChartWidget data={data} columns={columns} expanded={expanded} />;
    case 'line':
      return <LineChartWidget data={data} columns={columns} expanded={expanded} />;
    case 'pie':
      return <PieChartWidget data={data} columns={columns} expanded={expanded} />;
    case 'table':
    default:
      return <DataTableWidget data={data} columns={columns} expanded={expanded} />;
  }
}


// ── KPI Widget ───────────────────────────────────────────────────────────────
function KPIWidget({ data, columns }) {
  const row = data[0] || {};
  return (
    <div style={styles.kpiContainer}>
      {columns.map((col, i) => (
        <div key={col} style={styles.kpiCard}>
          <span style={styles.kpiLabel}>{col.replace(/_/g, ' ')}</span>
          <span style={{ ...styles.kpiValue, color: CHART_COLORS[i % CHART_COLORS.length] }}>
            {_formatNumber(row[col])}
          </span>
        </div>
      ))}
    </div>
  );
}


// ── Bar Chart Widget (CSS-based) ─────────────────────────────────────────────
function BarChartWidget({ data, columns, expanded }) {
  const labelCol = columns[0];
  const valueCol = columns.length > 1 ? columns[columns.length - 1] : columns[0];
  const maxVal = Math.max(...data.map(d => Number(d[valueCol]) || 0), 1);
  const items = expanded ? data.slice(0, 20) : data.slice(0, 10);

  return (
    <div style={styles.barContainer}>
      {items.map((row, i) => {
        const val = Number(row[valueCol]) || 0;
        const pct = (val / maxVal) * 100;
        return (
          <div key={i} style={styles.barRow}>
            <span style={styles.barLabel}>{String(row[labelCol]).slice(0, 25)}</span>
            <div style={styles.barTrack}>
              <div style={{
                ...styles.barFill,
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, ${CHART_COLORS[(i + 1) % CHART_COLORS.length]})`,
              }} />
            </div>
            <span style={styles.barValue}>{_formatNumber(val)}</span>
          </div>
        );
      })}
    </div>
  );
}


// ── Line Chart Widget (CSS-based sparkline) ──────────────────────────────────
function LineChartWidget({ data, columns, expanded }) {
  const valueCol = columns.length > 1 ? columns[columns.length - 1] : columns[0];
  const labelCol = columns.length > 2 ? columns[2] : columns[0]; // month_name or first col
  const values = data.map(d => Number(d[valueCol]) || 0);
  const maxVal = Math.max(...values, 1);
  const items = expanded ? data : data.slice(0, 12);
  const vals = items.map(d => Number(d[valueCol]) || 0);

  return (
    <div style={styles.lineContainer}>
      <div style={styles.lineChart}>
        {vals.map((v, i) => (
          <div key={i} style={styles.linePoint}>
            <div style={{
              ...styles.lineDot,
              bottom: `${(v / maxVal) * 80}%`,
              background: CHART_COLORS[0],
            }} title={`${items[i]?.[labelCol]}: ${_formatNumber(v)}`} />
            <div style={{
              ...styles.lineBar,
              height: `${(v / maxVal) * 80}%`,
              background: `linear-gradient(to top, rgba(99,102,241,0.1), rgba(99,102,241,0.3))`,
            }} />
            <span style={styles.lineLabel}>
              {String(items[i]?.[labelCol] || i).slice(0, 5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Pie Chart Widget (CSS-based) ─────────────────────────────────────────────
function PieChartWidget({ data, columns }) {
  const labelCol = columns[0];
  const valueCol = columns.length > 1 ? columns[columns.length - 1] : columns[0];
  const total = data.reduce((s, d) => s + (Number(d[valueCol]) || 0), 0) || 1;
  const items = data.slice(0, 8);

  let accumulated = 0;
  const segments = items.map((row, i) => {
    const val = Number(row[valueCol]) || 0;
    const pct = (val / total) * 100;
    const start = accumulated;
    accumulated += pct;
    return { label: row[labelCol], val, pct, start, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  const gradient = segments.map(s => 
    `${s.color} ${s.start}% ${s.start + s.pct}%`
  ).join(', ');

  return (
    <div style={styles.pieContainer}>
      <div style={{
        ...styles.pieChart,
        background: `conic-gradient(${gradient})`,
      }} />
      <div style={styles.pieLegend}>
        {segments.map((s, i) => (
          <div key={i} style={styles.pieLegendItem}>
            <div style={{ ...styles.pieLegendDot, background: s.color }} />
            <span style={styles.pieLegendLabel}>{String(s.label).slice(0, 20)}</span>
            <span style={styles.pieLegendValue}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Data Table Widget ────────────────────────────────────────────────────────
function DataTableWidget({ data, columns, expanded }) {
  const rows = expanded ? data.slice(0, 50) : data.slice(0, 10);
  const cols = columns.slice(0, expanded ? 10 : 6);

  return (
    <div style={styles.tableContainer}>
      <table style={styles.dataTable}>
        <thead>
          <tr>
            {cols.map(col => (
              <th key={col} style={styles.tableHeader}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={i % 2 === 0 ? {} : { background: 'rgba(255,255,255,0.02)' }}>
              {cols.map(col => (
                <td key={col} style={styles.tableCell}>
                  {row[col] !== null && row[col] !== undefined ? String(row[col]).slice(0, 30) : 'NULL'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > rows.length && (
        <div style={styles.tableMore}>
          +{data.length - rows.length} lignes
        </div>
      )}
    </div>
  );
}


// ── Helpers ──────────────────────────────────────────────────────────────────
function _rowsToObjects(columns = [], rows = []) {
  return rows.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function _formatNumber(val) {
  if (val === null || val === undefined) return '—';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  if (Number.isInteger(num)) return num.toLocaleString();
  return num.toFixed(2);
}

function _suggestWidgetType(qr) {
  const title = (qr.title || '').toLowerCase();
  const sql = (qr.sql || '').toLowerCase();
  if (title.includes('kpi') || title.includes('global')) return 'kpi';
  if (title.includes('tendance') || title.includes('trend') || title.includes('evolution')) return 'line';
  if (title.includes('distribution') || title.includes('répartition')) return 'pie';
  if (title.includes('top') || sql.includes('top ')) return 'bar';
  if (qr.rows?.length > 5) return 'bar';
  return 'table';
}


// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  container: {
    display: 'flex', flexDirection: 'column', gap: '16px',
    padding: '20px', height: '100%', overflow: 'auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(99,102,241,0.05)',
    borderRadius: '12px', border: '1px solid rgba(99,102,241,0.15)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  headerTitle: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#e2e8f0' },
  badge: {
    padding: '2px 8px', borderRadius: '12px',
    background: 'rgba(99,102,241,0.2)', color: '#a5b4fc',
    fontSize: '11px', fontWeight: 600,
  },
  headerActions: { display: 'flex', gap: '8px' },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', borderRadius: '8px', border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.2s',
  },

  suggestionsPanel: {
    padding: '12px',
    background: 'rgba(15,15,20,0.9)',
    borderRadius: '12px', border: '1px solid #2d2d35',
  },
  suggestionsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '8px',
  },
  suggestionCard: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px', borderRadius: '8px',
    border: '1px solid #2d2d35',
    background: 'rgba(255,255,255,0.02)',
    cursor: 'pointer', transition: 'all 0.2s',
    textAlign: 'left',
  },
  suggestionTitle: { flex: 1, fontSize: '12px', color: '#e2e8f0', fontWeight: 500 },
  suggestionType: {
    padding: '2px 6px', borderRadius: '4px',
    background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
    fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
  },
  noSuggestions: { color: '#64748b', fontSize: '13px', gridColumn: '1 / -1', textAlign: 'center' },

  widgetsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: '16px',
  },
  widgetCard: {
    borderRadius: '12px', border: '1px solid #2d2d35',
    background: 'rgba(15,15,20,0.6)',
    backdropFilter: 'blur(12px)',
    overflow: 'hidden', transition: 'all 0.3s',
  },
  widgetHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  widgetHeaderLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
  widgetTitle: { fontSize: '13px', fontWeight: 600, color: '#e2e8f0' },
  widgetActions: { display: 'flex', gap: '4px' },
  iconBtn: {
    padding: '4px', borderRadius: '4px', border: 'none',
    background: 'transparent', color: '#64748b', cursor: 'pointer',
    transition: 'all 0.2s', display: 'flex', alignItems: 'center',
  },
  widgetBody: { padding: '14px', minHeight: '180px' },
  widgetFooter: {
    padding: '6px 14px',
    borderTop: '1px solid rgba(255,255,255,0.03)',
    background: 'rgba(0,0,0,0.2)',
  },
  sqlPreview: {
    fontSize: '10px', color: '#52525b', fontFamily: 'monospace',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    display: 'block',
  },

  loadingState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '10px', height: '160px', color: '#64748b',
  },
  errorState: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    padding: '12px', borderRadius: '8px',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
  },
  errorIcon: { fontSize: '16px' },
  errorText: { fontSize: '12px', color: '#fca5a5', lineHeight: 1.4, wordBreak: 'break-all' },
  emptyWidget: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '160px', color: '#52525b', fontSize: '13px',
  },

  // KPI
  kpiContainer: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
  },
  kpiCard: {
    display: 'flex', flexDirection: 'column', gap: '4px',
    padding: '14px', borderRadius: '10px',
    background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)',
    textAlign: 'center',
  },
  kpiLabel: { fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 },
  kpiValue: { fontSize: '22px', fontWeight: 800, fontFamily: 'monospace' },

  // Bar Chart
  barContainer: { display: 'flex', flexDirection: 'column', gap: '6px' },
  barRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  barLabel: { flex: '0 0 100px', fontSize: '11px', color: '#94a3b8', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barTrack: { flex: 1, height: '18px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' },
  barValue: { flex: '0 0 60px', fontSize: '11px', color: '#e2e8f0', fontWeight: 600, fontFamily: 'monospace' },

  // Line Chart
  lineContainer: { padding: '10px 0' },
  lineChart: { display: 'flex', alignItems: 'flex-end', gap: '2px', height: '150px', padding: '0 4px' },
  linePoint: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', height: '100%', justifyContent: 'flex-end' },
  lineDot: { width: '6px', height: '6px', borderRadius: '50%', position: 'absolute', zIndex: 1 },
  lineBar: { width: '100%', borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease' },
  lineLabel: { fontSize: '9px', color: '#64748b', marginTop: '4px', textAlign: 'center' },

  // Pie Chart
  pieContainer: { display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'center' },
  pieChart: { width: '120px', height: '120px', borderRadius: '50%', flexShrink: 0 },
  pieLegend: { display: 'flex', flexDirection: 'column', gap: '4px' },
  pieLegendItem: { display: 'flex', alignItems: 'center', gap: '6px' },
  pieLegendDot: { width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0 },
  pieLegendLabel: { fontSize: '11px', color: '#94a3b8', flex: 1 },
  pieLegendValue: { fontSize: '11px', color: '#e2e8f0', fontWeight: 600, fontFamily: 'monospace' },

  // Table
  tableContainer: { overflow: 'auto', maxHeight: '300px' },
  dataTable: { width: '100%', borderCollapse: 'collapse', fontSize: '11px' },
  tableHeader: {
    padding: '6px 10px', textAlign: 'left',
    background: 'rgba(99,102,241,0.1)', color: '#a5b4fc',
    fontWeight: 600, fontSize: '10px', textTransform: 'uppercase',
    borderBottom: '1px solid rgba(99,102,241,0.2)',
    position: 'sticky', top: 0,
  },
  tableCell: { padding: '5px 10px', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.03)' },
  tableMore: { textAlign: 'center', fontSize: '11px', color: '#64748b', padding: '8px', fontStyle: 'italic' },

  // Empty State
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '12px', height: '100%',
    padding: '40px',
  },
  emptyTitle: { margin: 0, fontSize: '18px', color: '#e2e8f0', fontWeight: 700 },
  emptyText: { color: '#64748b', fontSize: '13px', textAlign: 'center', lineHeight: 1.6 },

  // Modal
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '90vw', maxWidth: '1000px', maxHeight: '85vh',
    borderRadius: '16px', border: '1px solid #2d2d35',
    background: '#0f0f14', padding: '24px', overflow: 'auto',
    position: 'relative',
  },
  modalClose: {
    position: 'absolute', top: '12px', right: '12px',
    padding: '6px', borderRadius: '6px', border: 'none',
    background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
    cursor: 'pointer',
  },
};
