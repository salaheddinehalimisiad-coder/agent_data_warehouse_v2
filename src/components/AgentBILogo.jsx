// src/components/AgentBILogo.jsx — Logo officiel Agent BI (SVG inline animé)
//
// Design : hexagone prismatique (data warehouse multi-nœuds) + 3 barres BI
// ascendantes reliées par un chemin neuronal + orbe IA pulsant au sommet.
// Le composant est entièrement vectoriel, scalable, et utilise les couleurs
// de la marque (indigo → violet → purple) en harmonie avec le design system.
//
// Props :
//   size     : taille en px (defaults 40)
//   variant  : 'mark' (minimal, pour UI) | 'hero' (détaillé, pour splashes)
//   animated : active le pulse de l'orbe IA et le halo qui respire
//   className : classes additionnelles (ex. shadow-glow-violet)
//
import { motion } from 'framer-motion';

export default function AgentBILogo({
  size = 40,
  variant = 'mark',
  animated = true,
  className = '',
  title = 'Agent BI',
}) {
  // On génère des IDs uniques pour éviter les collisions si plusieurs instances
  // du logo cohabitent sur la même page (gradients partagés = bug visuel).
  const uid = `abi-${variant}-${size}`;
  const gFrame = `${uid}-frame`;
  const gBars  = `${uid}-bars`;
  const gHalo  = `${uid}-halo`;
  const gHex   = `${uid}-hex`;
  const gSpark = `${uid}-spark`;
  const fGlow  = `${uid}-glow`;

  const isHero = variant === 'hero';
  const vb = isHero ? '0 0 128 128' : '0 0 64 64';

  // Points pour l'hexagone principal
  const hexOuter = isHero
    ? '64,10 111,37 111,91 64,118 17,91 17,37'
    : '32,5 55.5,18 55.5,46 32,59 8.5,46 8.5,18';
  const hexInner = isHero
    ? '64,24 97,43 97,85 64,104 31,85 31,43'
    : '32,13 48.5,22 48.5,42 32,51 15.5,42 15.5,22';

  // Coordonnées des barres et des nodes (dimensionnement proportionnel)
  const geom = isHero ? {
    baseline: { y: 88, x1: 34, x2: 94 },
    bars: [
      { x: 38,   y: 62, w: 8.8, h: 26, topX: 42.4, topY: 62 },
      { x: 59.6, y: 44, w: 8.8, h: 44, topX: 64,   topY: 44 },
      { x: 81.2, y: 54, w: 8.8, h: 34, topX: 85.6, topY: 54 },
    ],
    spark:  { cx: 64, cy: 10, halo: 13, core: 5, dot: 2 },
    vertex: [
      { cx: 111, cy: 37, r: 3, c: '#A855F7' },
      { cx: 111, cy: 91, r: 3, c: '#6366F1' },
      { cx: 64,  cy: 118, r: 3, c: '#8B5CF6' },
      { cx: 17,  cy: 91, r: 3, c: '#6366F1' },
      { cx: 17,  cy: 37, r: 3, c: '#A855F7' },
    ],
    orbit: { cx: 64, cy: 64, r: 56 },
    stroke: 3.2,
    topNode: 4,
    sideNode: 3.2,
  } : {
    baseline: { y: 44, x1: 17, x2: 47 },
    bars: [
      { x: 19,   y: 31, w: 4.4, h: 13, topX: 21.2, topY: 31 },
      { x: 29.8, y: 22, w: 4.4, h: 22, topX: 32,   topY: 22 },
      { x: 40.6, y: 27, w: 4.4, h: 17, topX: 42.8, topY: 27 },
    ],
    spark:  { cx: 32, cy: 5, halo: 6, core: 2.4, dot: 1 },
    vertex: [
      { cx: 55.5, cy: 18, r: 1.5, c: '#A855F7' },
      { cx: 55.5, cy: 46, r: 1.5, c: '#6366F1' },
      { cx: 32,   cy: 59, r: 1.5, c: '#8B5CF6' },
      { cx: 8.5,  cy: 46, r: 1.5, c: '#6366F1' },
      { cx: 8.5,  cy: 18, r: 1.5, c: '#A855F7' },
    ],
    orbit: null,
    stroke: 2.4,
    topNode: 2.0,
    sideNode: 1.6,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={vb}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gFrame} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0"    stopColor="#6366F1"/>
          <stop offset="0.55" stopColor="#8B5CF6"/>
          <stop offset="1"    stopColor="#A855F7"/>
        </linearGradient>
        <linearGradient id={gBars} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#4F46E5"/>
          <stop offset="1" stopColor="#C4B5FD"/>
        </linearGradient>
        <radialGradient id={gHalo} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8B5CF6" stopOpacity="0.42"/>
          <stop offset="1" stopColor="#8B5CF6" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={gHex} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1020"/>
          <stop offset="1" stopColor="#14142B"/>
        </linearGradient>
        <radialGradient id={gSpark} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0"    stopColor="#FFFFFF" stopOpacity="1"/>
          <stop offset="0.45" stopColor="#C4B5FD" stopOpacity="0.7"/>
          <stop offset="1"    stopColor="#8B5CF6" stopOpacity="0"/>
        </radialGradient>
        {isHero && (
          <filter id={fGlow} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        )}
      </defs>

      {/* Ambient halo (animé en mode animated) */}
      {animated ? (
        <motion.circle
          cx={isHero ? 64 : 32}
          cy={isHero ? 64 : 32}
          r={isHero ? 62 : 30}
          fill={`url(#${gHalo})`}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <circle
          cx={isHero ? 64 : 32}
          cy={isHero ? 64 : 32}
          r={isHero ? 62 : 30}
          fill={`url(#${gHalo})`}
        />
      )}

      {/* Orbit ring (hero uniquement) */}
      {geom.orbit && (
        <motion.circle
          cx={geom.orbit.cx}
          cy={geom.orbit.cy}
          r={geom.orbit.r}
          fill="none"
          stroke={`url(#${gFrame})`}
          strokeWidth="0.8"
          strokeOpacity="0.25"
          strokeDasharray="2 4"
          animate={animated ? { rotate: 360 } : undefined}
          transition={animated ? { duration: 28, repeat: Infinity, ease: 'linear' } : undefined}
          style={{ transformOrigin: `${geom.orbit.cx}px ${geom.orbit.cy}px` }}
        />
      )}

      {/* Hex prism principal */}
      <polygon
        points={hexOuter}
        fill={`url(#${gHex})`}
        stroke={`url(#${gFrame})`}
        strokeWidth={geom.stroke}
        strokeLinejoin="round"
        filter={isHero ? `url(#${fGlow})` : undefined}
      />

      {/* Hex de profondeur */}
      <polygon
        points={hexInner}
        fill="none"
        stroke={`url(#${gFrame})`}
        strokeWidth={isHero ? 1 : 0.8}
        strokeOpacity="0.28"
        strokeLinejoin="round"
      />

      {/* Baseline */}
      <line
        x1={geom.baseline.x1} y1={geom.baseline.y} x2={geom.baseline.x2} y2={geom.baseline.y}
        stroke={`url(#${gFrame})`} strokeWidth={isHero ? 1.6 : 1.2} strokeOpacity="0.38" strokeLinecap="round"
      />

      {/* 3 barres BI ascendantes */}
      {geom.bars.map((b, i) => (
        <rect
          key={`bar-${i}`}
          x={b.x} y={b.y} width={b.w} height={b.h}
          rx={isHero ? 2.2 : 1.2}
          fill={`url(#${gBars})`}
        />
      ))}

      {/* Chemin neuronal reliant les sommets */}
      <path
        d={`M${geom.bars[0].topX} ${geom.bars[0].topY} L${geom.bars[1].topX} ${geom.bars[1].topY} L${geom.bars[2].topX} ${geom.bars[2].topY}`}
        fill="none"
        stroke="#C4B5FD"
        strokeWidth={isHero ? 2 : 1}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.72"
      />

      {/* Nodes au sommet des barres */}
      <circle cx={geom.bars[0].topX} cy={geom.bars[0].topY} r={geom.sideNode} fill="#E0E7FF"/>
      <circle cx={geom.bars[1].topX} cy={geom.bars[1].topY} r={geom.topNode}  fill="#FFFFFF"/>
      <circle cx={geom.bars[2].topX} cy={geom.bars[2].topY} r={geom.sideNode} fill="#E0E7FF"/>

      {/* Orbe IA au sommet — pulse en mode animated */}
      {animated ? (
        <motion.circle
          cx={geom.spark.cx} cy={geom.spark.cy} r={geom.spark.halo}
          fill={`url(#${gSpark})`}
          animate={{ scale: [1, 1.18, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: `${geom.spark.cx}px ${geom.spark.cy}px` }}
        />
      ) : (
        <circle cx={geom.spark.cx} cy={geom.spark.cy} r={geom.spark.halo} fill={`url(#${gSpark})`}/>
      )}
      <circle cx={geom.spark.cx} cy={geom.spark.cy} r={geom.spark.core} fill="#FFFFFF"/>
      <circle cx={geom.spark.cx} cy={geom.spark.cy} r={geom.spark.dot}  fill="#A855F7"/>

      {/* Agent dots aux sommets de l'hexagone */}
      {geom.vertex.map((v, i) => (
        <circle key={`v-${i}`} cx={v.cx} cy={v.cy} r={v.r} fill={v.c}/>
      ))}
    </svg>
  );
}
