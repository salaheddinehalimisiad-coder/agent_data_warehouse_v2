import React, { useState, useMemo } from 'react';
import {
  Book, ChevronRight, Terminal, Database, Code, Shield, Network,
  Zap, Play, Box, Star, ArrowRight, Bot, Search, FileText, Cpu,
  Activity, Workflow, CheckCircle2, Cloud, HardDrive, LayoutGrid,
  Sparkles, User, Calendar, Clock, Lock, Settings, Server, GitBranch,
  Layers, BarChart3, Eye, Heart, Compass, Cog, Package, Globe, Key,
  AlertTriangle, FileBarChart, Boxes, ShieldCheck, Wrench, Send,
  Filter, GitMerge, Hash, Map, MessageSquare, PieChart, Radio,
  Repeat, RotateCcw, Trophy, Wifi, ImageIcon, Crop, Camera,
  Image as ImageLucide
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
//  COMPOSANTS RÉUTILISABLES — THÈME CLAIR (style Oracle / PostgreSQL / Stripe)
// =============================================================================

const CodeBlock = ({ language, code, filename }) => (
  <figure className="my-7 rounded-xl overflow-hidden border border-slate-300 shadow-sm bg-[#1e1e1e]">
    <header className="flex items-center px-4 py-2.5 bg-slate-800 border-b border-slate-700">
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400/90"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/90"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/90"></span>
      </div>
      <span className="ml-4 text-[10.5px] font-bold font-mono text-slate-300 uppercase tracking-widest">
        {language}
      </span>
      {filename && (
        <span className="ml-auto text-[11px] font-mono text-slate-400 italic">{filename}</span>
      )}
    </header>
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      customStyle={{
        margin: 0,
        padding: '1.5rem',
        background: '#1e1e1e',
        fontSize: '13px',
        lineHeight: '1.7',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
      }}
      wrapLines
    >
      {code}
    </SyntaxHighlighter>
  </figure>
);

const Callout = ({ type = 'info', title, children }) => {
  const styles = {
    info:    { bg: 'bg-blue-50',    border: 'border-blue-300',    text: 'text-blue-900',    icon: 'text-blue-600' },
    warning: { bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-900',   icon: 'text-amber-600' },
    success: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-900', icon: 'text-emerald-600' },
    danger:  { bg: 'bg-rose-50',    border: 'border-rose-300',    text: 'text-rose-900',    icon: 'text-rose-600' },
    note:    { bg: 'bg-slate-50',   border: 'border-slate-300',   text: 'text-slate-800',   icon: 'text-slate-600' },
    tip:     { bg: 'bg-violet-50',  border: 'border-violet-300',  text: 'text-violet-900',  icon: 'text-violet-600' }
  };
  const s = styles[type];
  const Icon = {
    info: Book, warning: AlertTriangle, success: CheckCircle2,
    danger: Lock, note: FileText, tip: Sparkles
  }[type];
  return (
    <aside className={`my-6 px-5 py-4 rounded-lg border-l-4 ${s.bg} ${s.border} ${s.text} flex gap-3.5 items-start`}>
      <Icon size={20} className={`${s.icon} mt-0.5 shrink-0`} />
      <div className="min-w-0">
        <h4 className="font-bold text-[13.5px] mb-1.5 uppercase tracking-wider">{title}</h4>
        <div className="text-[14.5px] leading-relaxed">{children}</div>
      </div>
    </aside>
  );
};

const Section = ({ id, title, children }) => (
  <section id={id} className="mb-14 scroll-mt-24">
    <h2 className="text-[26px] font-bold text-slate-900 mb-5 pb-3 border-b-2 border-indigo-600/80 inline-block tracking-tight">
      {title}
    </h2>
    <div className="text-[15.5px] text-slate-700 leading-[1.85] space-y-4 mt-6">
      {children}
    </div>
  </section>
);

const SubSection = ({ id, title, children }) => (
  <div id={id} className="mt-10 mb-5 scroll-mt-24">
    <h3 className="text-[20px] font-semibold text-slate-900 mb-3 leading-tight">
      {title}
    </h3>
    <div className="text-[15px] text-slate-700 leading-[1.85] space-y-3.5">
      {children}
    </div>
  </div>
);

const SubSubSection = ({ id, title, children }) => (
  <div id={id} className="mt-7 mb-3 scroll-mt-24">
    <h4 className="text-[16.5px] font-semibold text-slate-800 mb-2.5">
      {title}
    </h4>
    <div className="text-[14.5px] text-slate-700 leading-[1.8] space-y-3">
      {children}
    </div>
  </div>
);

const DataTable = ({ headers, rows, caption }) => (
  <figure className="my-7 rounded-lg overflow-hidden border border-slate-300 bg-white shadow-sm">
    {caption && (
      <figcaption className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 text-[11.5px] font-bold text-slate-700 uppercase tracking-wider">
        {caption}
      </figcaption>
    )}
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="bg-slate-50 border-b-2 border-slate-300">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={`border-b border-slate-200 ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-slate-700 align-top leading-relaxed">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </figure>
);

const ModuleCard = ({ icon, name, role, inputs, outputs, color = 'indigo' }) => {
  const palette = {
    indigo:  'border-indigo-200 bg-indigo-50/40',
    purple:  'border-purple-200 bg-purple-50/40',
    cyan:    'border-cyan-200 bg-cyan-50/40',
    emerald: 'border-emerald-200 bg-emerald-50/40',
    amber:   'border-amber-200 bg-amber-50/40',
    rose:    'border-rose-200 bg-rose-50/40',
    slate:   'border-slate-200 bg-slate-50'
  };
  return (
    <div className={`my-4 p-5 rounded-lg border ${palette[color]}`}>
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-white border border-slate-200 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h4 className="font-bold text-slate-900 text-[16px]">{name}</h4>
            <span className="text-[10px] font-mono uppercase tracking-widest bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
              module
            </span>
          </div>
          <p className="text-slate-700 leading-relaxed text-[14px]">{role}</p>
          {inputs && (
            <div className="mt-3 text-[12.5px] text-slate-600 font-mono">
              <span className="font-bold text-slate-800 not-italic">Entrées : </span>
              <code>{inputs}</code>
            </div>
          )}
          {outputs && (
            <div className="mt-1 text-[12.5px] text-slate-600 font-mono">
              <span className="font-bold text-slate-800 not-italic">Sorties : </span>
              <code>{outputs}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Kbd = ({ children }) => (
  <kbd className="px-1.5 py-0.5 mx-0.5 text-[11.5px] font-mono font-semibold rounded border border-slate-300 bg-slate-100 text-slate-700 shadow-[inset_0_-1px_0_0_rgb(203,213,225)]">
    {children}
  </kbd>
);

const DefinitionList = ({ items }) => (
  <dl className="my-5 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-y-3 gap-x-6 text-[14.5px]">
    {items.map((it, i) => (
      <React.Fragment key={i}>
        <dt className="font-bold text-indigo-700 uppercase tracking-wider text-[11.5px] pt-1">{it.term}</dt>
        <dd className="text-slate-700 leading-relaxed">{it.def}</dd>
      </React.Fragment>
    ))}
  </dl>
);

// Image de documentation — s'affiche uniquement si le fichier existe
const DocImage = ({ src, caption, height }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <figure className="my-9 rounded-xl border border-slate-300 bg-white overflow-hidden shadow-sm">
      <img
        src={src}
        alt={caption}
        className="w-full h-auto object-contain bg-white"
        style={height ? { maxHeight: `${height}px` } : {}}
        onError={() => setFailed(true)}
      />
      {caption && (
        <figcaption className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-[13px] text-slate-600 text-center font-medium">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

const PartHeader = ({ part, title, subtitle, tags = [] }) => (
  <header className="mb-12 pb-9 border-b border-slate-200">
    <div className="text-indigo-600 font-mono text-[11.5px] uppercase tracking-[0.25em] mb-3 font-bold">
      Chapitre {part}
    </div>
    <h1 className="text-[40px] md:text-[46px] font-bold text-slate-900 mb-5 leading-[1.1] tracking-tight">
      {title}
    </h1>
    <p className="text-[17px] text-slate-600 leading-relaxed max-w-4xl">
      {subtitle}
    </p>
    {tags.length > 0 && (
      <div className="flex gap-2 flex-wrap mt-5">
        {tags.map((t, i) => (
          <span
            key={i}
            className="text-[11px] font-bold uppercase tracking-widest bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded"
          >
            {t}
          </span>
        ))}
      </div>
    )}
  </header>
);

// =============================================================================
//  COMPOSANT PRINCIPAL
// =============================================================================
export default function DocumentationPage({ initialTab = 'p1-intro' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const docs = [

    // ========================================================================
    //  P1 — INTRODUCTION AU DATA WAREHOUSING
    // ========================================================================
    {
      id: 'p1-intro',
      part: 'P1',
      category: 'Concepts Fondamentaux',
      title: 'P1 — Introduction au Data Warehousing',
      icon: <Book size={17} />,
      toc: [
        { id: 'p1-context',     label: '1.1 Contexte et historique' },
        { id: 'p1-definitions', label: '1.2 Définitions de référence' },
        { id: 'p1-oltp-olap',   label: '1.3 OLTP vs OLAP' },
        { id: 'p1-3v',          label: '1.4 Les dimensions du Big Data' },
        { id: 'p1-kimball',     label: '1.5 Méthodologie Kimball' },
        { id: 'p1-inmon',       label: '1.6 Méthodologie Inmon' },
        { id: 'p1-data-vault',  label: '1.7 Data Vault 2.0' },
        { id: 'p1-lakehouse',   label: '1.8 L\'architecture Lakehouse' },
        { id: 'p1-architecture-medallion', label: '1.9 Architecture en médaille' },
        { id: 'p1-positioning', label: '1.10 Positionnement d\'Agent BI' },
        { id: 'p1-references',  label: '1.11 Références bibliographiques' }
      ],
      content: (
        <>
          <PartHeader
            part="1"
            title="Introduction au Data Warehousing"
            subtitle="Ce premier chapitre établit les fondations conceptuelles indispensables avant d'aborder l'architecture technique d'Agent BI. L'évolution historique des entrepôts de données, les distinctions OLTP / OLAP, les méthodologies Kimball, Inmon et Data Vault, ainsi que le positionnement de la plateforme dans l'écosystème actuel y sont abordés en profondeur."
            tags={['Théorie', 'Kimball', 'Inmon', 'Data Vault', 'Lakehouse']}
          />

          <Section id="p1-context" title="1.1 Contexte et historique du Data Warehousing">
            <p>
              Le concept d&apos;entrepôt de données émerge à la fin des années 1980 sous l&apos;impulsion de William H. Inmon, considéré comme le père du Data Warehousing. À cette époque, les organisations constatent que leurs systèmes opérationnels (ERP, CRM, comptabilité) sont incapables de répondre aux questions analytiques de la direction générale. Des questions aussi simples qu&apos;<em>« Quel est le chiffre d&apos;affaires consolidé par région et par trimestre depuis trois exercices ? »</em> ou <em>« Quel produit présente la meilleure marge sur la cohorte 2018-2024 ? »</em> exigent des heures de calcul et perturbent gravement la production transactionnelle.
            </p>
            <p>
              La cause est structurelle. Les bases relationnelles opérationnelles (OLTP, Online Transaction Processing) sont normalisées en troisième forme normale ou en forme normale de Boyce-Codd afin de garantir la cohérence transactionnelle, l&apos;intégrité référentielle et la suppression des redondances. Cette normalisation, parfaitement adaptée aux écritures fréquentes et atomiques, devient un handicap majeur pour les requêtes analytiques. Une simple consolidation de chiffre d&apos;affaires par région peut nécessiter dix à quinze jointures imbriquées, dont chacune impose un coût d&apos;exécution significatif.
            </p>
            <p>
              La solution proposée par Inmon, raffinée ensuite par Ralph Kimball au milieu des années 1990, consiste à dupliquer périodiquement les données opérationnelles vers une base secondaire dédiée. Cette base, dénormalisée et optimisée pour la lecture massive, constitue l&apos;entrepôt de données. Dès lors, la base opérationnelle n&apos;est plus jamais sollicitée par les rapports : elle conserve ses performances transactionnelles tandis que la nouvelle base sert toutes les charges analytiques.
            </p>
            <p>
              Trente-cinq ans plus tard, le besoin n&apos;a pas disparu. Il s&apos;est démultiplié. Une organisation de taille moyenne dispose aujourd&apos;hui de quinze à cinquante sources de données hétérogènes : bases opérationnelles SQL Server ou PostgreSQL, plateformes SaaS (Salesforce, HubSpot, Stripe, Zendesk), flux d&apos;analytique web (Google Analytics, Matomo), fichiers plats échangés entre départements, et API REST internes ou partenaires. L&apos;intégration manuelle de ces sources reste l&apos;un des projets de système d&apos;information les plus coûteux et les plus longs.
            </p>

            <Callout type="info" title="Coût observé d'un projet d'entrepôt classique">
              D&apos;après l&apos;étude Gartner <em>Data &amp; Analytics 2024</em>, soixante-deux pour cent des projets de Data Warehouse dépassent leur budget initial de plus de quarante pour cent, et quarante-huit pour cent dépassent leur calendrier de plus de six mois. La cause numéro un invoquée demeure invariable depuis vingt ans : la modélisation manuelle et la maintenance des pipelines d&apos;intégration.
            </Callout>

            <SubSection id="p1-history-decades" title="1.1.1 Les décennies clés">
              <p>
                L&apos;histoire récente du Data Warehousing peut être structurée en cinq périodes successives, chacune marquée par une rupture technologique ou méthodologique majeure.
              </p>
              <DataTable
                caption="Tableau 1.1 — Périodisation du Data Warehousing"
                headers={['Période', 'Rupture', 'Acteurs emblématiques']}
                rows={[
                  ['1985-1995', 'Émergence du concept, premiers EDW',                  'Teradata, IBM DB2, Oracle, Bill Inmon'],
                  ['1995-2005', 'Modélisation dimensionnelle Kimball',                 'Microsoft SQL Server, Informatica, Cognos'],
                  ['2005-2012', 'Open source et premiers MPP appliances',              'Greenplum, Vertica, Pentaho, Talend'],
                  ['2012-2020', 'Cloud-native et séparation stockage/calcul',          'Amazon Redshift, Snowflake, BigQuery'],
                  ['2020-aujourd\'hui', 'Lakehouse, ELT, gouvernance fédérée',          'Databricks, dbt Labs, Apache Iceberg, Atlan']
                ]}
              />
            </SubSection>

            <SubSection id="p1-history-context" title="1.1.2 Le contexte économique actuel">
              <p>
                Trois forces simultanées expliquent la pression actuelle sur les architectures d&apos;intégration. Première force : la prolifération des sources. Une entreprise de cinq cents salariés cumule en moyenne soixante-dix-huit applications distinctes en 2025, contre vingt-deux en 2015. Deuxième force : l&apos;exigence de fraîcheur. Les directions métier ne se contentent plus d&apos;un rapport hebdomadaire ou quotidien ; elles demandent des tableaux de bord à actualisation horaire, voire temps réel, pour piloter les opérations. Troisième force : la pression réglementaire. Le Règlement Général sur la Protection des Données, la directive NIS 2, le Digital Operational Resilience Act et la loi Sapin II imposent des contraintes de traçabilité, de minimisation et de réversibilité que les entrepôts traditionnels couvrent mal.
              </p>
              <p>
                Agent BI a été conçu pour répondre simultanément à ces trois pressions. La plateforme automatise la conception et la maintenance des pipelines, supporte des cycles d&apos;exécution incrémentaux à fréquence configurable, et embarque nativement les fonctions de catalogue, de lineage et de gestion des données personnelles requises par les nouveaux régimes réglementaires.
              </p>
            </SubSection>
          </Section>

          <DocImage
            src="/docs-screenshots/doc-screenshot-landing.png"
            caption="Page d'accueil de l'application Agent BI"
          />

          <Section id="p1-definitions" title="1.2 Définitions de référence">
            <p>
              Les termes employés dans la suite du document suivent les définitions consensuelles établies par le <em>Data Management Body of Knowledge</em> (DMBoK), seconde édition, publiée par DAMA International en 2017, et par les ouvrages canoniques de Kimball et Inmon. Lorsque ces sources divergent, la définition de Kimball est privilégiée car elle correspond à la méthodologie majoritairement appliquée par Agent BI.
            </p>
            <DefinitionList
              items={[
                { term: 'Data Warehouse',     def: "Base de données analytique, orientée sujet, intégrée, historisée et non-volatile, conçue pour soutenir le processus décisionnel (Inmon, 1992)." },
                { term: 'Data Mart',          def: "Sous-ensemble d'un Data Warehouse focalisé sur un domaine métier précis (ventes, ressources humaines, finance). Il est généralement matérialisé sous la forme d'un schéma en étoile dédié." },
                { term: 'ETL',                def: "Extract — Transform — Load. Pipeline qui extrait les données des sources opérationnelles, les transforme (nettoyage, enrichissement, dénormalisation, application des règles métier) puis les charge dans la base cible." },
                { term: 'ELT',                def: "Variante moderne de l'ETL où la transformation se réalise à l'intérieur même de la base cible, généralement en SQL via un outil comme dbt. Cette approche tire parti de la puissance des moteurs analytiques cloud." },
                { term: 'OLAP',               def: "Online Analytical Processing. Famille de charges de travail orientées lecture massive, agrégations, drill-down et slice-and-dice." },
                { term: 'OLTP',               def: "Online Transaction Processing. Famille de charges de travail orientées écriture transactionnelle avec garanties d'atomicité, de cohérence, d'isolation et de durabilité." },
                { term: 'CDC',                def: "Change Data Capture. Mécanisme qui détecte uniquement les lignes modifiées depuis la dernière extraction, évitant ainsi les rechargements complets coûteux." },
                { term: 'SCD Type 2',         def: "Slowly Changing Dimension de type 2. Technique d'historisation d'une dimension par insertion d'une nouvelle ligne avec colonnes valid_from, valid_to et is_current à chaque modification d'attribut." },
                { term: 'Surrogate Key',      def: "Clé technique générée par l'entrepôt (séquence INT IDENTITY ou hash) servant de clé primaire des dimensions. Elle découple l'entrepôt des changements de business key dans la source." },
                { term: 'Conformed Dimension', def: "Dimension partagée entre plusieurs data marts, garantissant la cohérence sémantique inter-domaines (un client unique entre les ventes, le support et la facturation)." },
                { term: 'Grain',              def: "Niveau de détail le plus fin d'une table de faits (par exemple : une ligne de commande, un événement clic, un appel téléphonique). Le grain doit être déclaré explicitement avant toute modélisation." },
                { term: 'Drill-down',         def: "Navigation analytique du général vers le détaillé (de l'année au trimestre, du trimestre au mois, du mois au jour)." },
                { term: 'Slice & Dice',       def: "Opération consistant à filtrer un cube OLAP selon une dimension (slice) et à pivoter selon plusieurs dimensions simultanément (dice)." }
              ]}
            />
          </Section>

          <Section id="p1-oltp-olap" title="1.3 OLTP versus OLAP : la rupture fondamentale">
            <p>
              La distinction entre charges transactionnelles et charges analytiques constitue le socle conceptuel sur lequel reposent toutes les décisions architecturales d&apos;Agent BI. Le tableau suivant synthétise les divergences essentielles entre les deux familles.
            </p>
            <DataTable
              caption="Tableau 1.2 — Comparaison OLTP / OLAP"
              headers={['Critère', 'OLTP — Opérationnel', 'OLAP — Analytique']}
              rows={[
                ['Objectif principal',     'Enregistrer les événements du métier',          'Répondre aux questions décisionnelles'],
                ['Population utilisateurs', 'Centaines à milliers d\'utilisateurs',          'Quelques dizaines d\'analystes'],
                ['Volume par requête',     'Lecture/écriture de quelques lignes',           'Lecture de millions à milliards de lignes'],
                ['Modélisation',           'Normalisée (3NF / BCNF)',                       'Dénormalisée (étoile, flocon, vault)'],
                ['Temps de réponse cible', 'Millisecondes',                                  'Secondes à minutes'],
                ['Profondeur d\'historique','État courant uniquement',                       'Historique complet sur N années'],
                ['Index',                  'B-Tree sur clés primaires',                      'Bitmap, columnstore, partitionnement'],
                ['Transactions',           'ACID strict',                                    'Eventual consistency tolérée'],
                ['Patterns de requête',    'Connus à l\'avance, optimisés',                 'Ad-hoc, exploratoires'],
                ['Exemple typique',        'Site e-commerce, application bancaire',          'Tableau de bord exécutif Power BI']
              ]}
            />
            <p>
              Lorsqu&apos;une organisation tente d&apos;exécuter des rapports analytiques directement sur la base opérationnelle, deux phénomènes se manifestent simultanément. D&apos;une part, les requêtes analytiques s&apos;exécutent anormalement lentement car la modélisation 3NF impose des dizaines de jointures imbriquées. D&apos;autre part, ces requêtes longues posent des verrous prolongés qui ralentissent les transactions du métier. Cette dégradation est particulièrement critique sur un site marchand en heure de pointe, où une seconde de latence supplémentaire se traduit par une perte mesurable de chiffre d&apos;affaires.
            </p>
            <p>
              Agent BI résout ce dilemme en générant un schéma OLAP dédié, peuplé périodiquement par un pipeline d&apos;intégration synthétisé automatiquement. La base opérationnelle n&apos;est plus jamais sollicitée pour l&apos;analytique au-delà de la lecture incrémentale CDC, qui n&apos;impose aucun verrou prolongé.
            </p>

            <SubSection id="p1-isolation" title="1.3.1 La séparation physique des charges">
              <p>
                La séparation physique entre OLTP et OLAP n&apos;est pas un simple choix d&apos;optimisation. Elle protège l&apos;activité transactionnelle des aléas de l&apos;exploration analytique. Un analyste qui rédige par mégarde une jointure cartésienne sur dix millions de lignes ne peut plus mettre à genoux le service client. Cette propriété d&apos;isolation explique pourquoi tous les grands éditeurs analytiques, sans exception, recommandent une infrastructure dédiée pour le décisionnel.
              </p>
              <p>
                Agent BI pousse cette logique d&apos;isolation un cran plus loin. Le service de génération du modèle, le service d&apos;exécution ETL et le service de consultation des rapports peuvent s&apos;exécuter sur trois clusters distincts, voire dans trois zones réseau différentes. Cette ségrégation permet d&apos;appliquer des politiques de sécurité différenciées : la zone de génération a besoin d&apos;accès au modèle linguistique, la zone d&apos;exécution a besoin d&apos;accès aux bases de données, la zone de consultation n&apos;a besoin que de l&apos;entrepôt en lecture.
              </p>
            </SubSection>
          </Section>

          <Section id="p1-3v" title="1.4 Les dimensions du Big Data">
            <p>
              Le terme Big Data a été popularisé en 2001 par Doug Laney, alors analyste chez Meta Group (devenu Gartner), à travers son modèle des trois V. Vingt-cinq ans plus tard, ce cadre demeure pédagogiquement le plus accessible. Il a depuis été enrichi par d&apos;autres dimensions — véracité, valeur, variabilité — sans que le triptyque originel ne perde de sa pertinence.
            </p>

            <SubSection id="p1-3v-volume" title="1.4.1 Volume">
              <p>
                Une banque de taille intermédiaire génère deux à cinq téraoctets de logs transactionnels par jour. Une plateforme de commerce électronique de premier plan traite cent millions de clics quotidiens. Un hôpital de huit cents lits produit environ vingt gigaoctets de données médicales sur vingt-quatre heures, sans compter l&apos;imagerie. Le volume cumulé d&apos;une organisation moyenne dépasse rapidement la capacité de mémoire et d&apos;entrées-sorties d&apos;une seule machine, ce qui impose un stockage distribué (HDFS, Amazon S3, Azure Data Lake Storage Gen2) et un traitement parallèle massif.
              </p>
              <p>
                Agent BI ne stocke pas lui-même les volumes massifs. La plateforme s&apos;appuie sur des moteurs cibles capables d&apos;encaisser ces ordres de grandeur : SQL Server avec columnstore, PostgreSQL en mode partitionné, Snowflake, Amazon Redshift, Google BigQuery ou Databricks SQL Warehouse. Le rôle d&apos;Agent BI consiste à orchestrer les pipelines vers ces moteurs en optimisant les écritures par lots (BULK INSERT, COPY, MERGE) plutôt qu&apos;en exécutions ligne à ligne.
              </p>
            </SubSection>

            <SubSection id="p1-3v-velocity" title="1.4.2 Vélocité">
              <p>
                Au-delà du volume cumulé, la vitesse à laquelle les données arrivent et doivent être traitées constitue le second défi majeur. La littérature distingue trois régimes de vélocité, chacun correspondant à des contraintes architecturales différentes.
              </p>
              <DataTable
                caption="Tableau 1.3 — Régimes de vélocité"
                headers={['Régime', 'Latence cible', 'Cas d\'usage', 'Support Agent BI']}
                rows={[
                  ['Batch nocturne',  '4 à 24 heures',  'Reporting financier, comptabilité', 'Natif via scheduler généré'],
                  ['Micro-batch',     '5 à 60 minutes', 'Tableaux de bord opérationnels',   'Natif via Airflow'],
                  ['Streaming',       'Sous la seconde','Détection de fraude, IoT',          'Intégration future via Kafka'],
                  ['On-demand',       'À la requête',   'Exploration ad-hoc',                'Via QueryGenerator']
                ]}
              />
            </SubSection>

            <SubSection id="p1-3v-variety" title="1.4.3 Variété">
              <p>
                Les données proviennent aujourd&apos;hui de schémas extrêmement hétérogènes. La distinction classique entre données structurées (tables relationnelles), semi-structurées (JSON, XML, Avro, Parquet) et non structurées (texte libre, images, vidéos, audio, PDF) reste d&apos;actualité, à laquelle s&apos;ajoutent les données graphes (Neo4j, JanusGraph) et les séries temporelles spécialisées (InfluxDB, TimescaleDB).
              </p>
              <p>
                Agent BI se concentre actuellement sur le tabulaire et le semi-structuré. Les connecteurs natifs couvrent SQL Server, PostgreSQL, MySQL, MariaDB, Oracle Database, MongoDB, fichiers CSV et fichiers Excel, ainsi que les fichiers de sauvegarde .bak SQL Server. Le support des sources non structurées (extraction depuis PDF, OCR sur images) figure dans la feuille de route à moyen terme et s&apos;effectuera via des connecteurs spécialisés.
              </p>
            </SubSection>

            <SubSection id="p1-3v-veracity" title="1.4.4 Véracité, valeur, variabilité">
              <p>
                Les V ajoutés ultérieurement par la communauté éclairent des préoccupations modernes. La véracité interroge la qualité intrinsèque de la donnée : une adresse mal saisie, un montant en mauvaise devise, une date au format ambigu. La valeur rappelle qu&apos;un projet d&apos;entrepôt n&apos;a de sens que s&apos;il génère un retour sur investissement mesurable. La variabilité décrit le fait que le sens d&apos;une même donnée peut évoluer dans le temps : la définition d&apos;un client actif peut changer entre deux exercices comptables.
              </p>
              <p>
                Le module DataQuality d&apos;Agent BI adresse explicitement la véracité. Il évalue douze dimensions de qualité à chaque cycle d&apos;exécution et bloque la mise en production si le score global tombe en dessous d&apos;un seuil paramétrable. Le chapitre dédié à la qualité présente cette mécanique en détail.
              </p>
            </SubSection>
          </Section>

          <Section id="p1-kimball" title="1.5 La méthodologie Kimball">
            <p>
              Ralph Kimball, dans son ouvrage de référence <em>The Data Warehouse Toolkit</em> publié pour la première fois en 1996 et révisé en 2002 puis en 2013, propose une approche ascendante. La construction commence par des data marts départementaux organisés en schéma en étoile, qui sont ensuite fédérés via des dimensions conformées. Cette approche privilégie la livraison rapide de valeur, sprint après sprint, plutôt que la mise en place d&apos;une infrastructure centralisée préalable.
            </p>

            <SubSection id="p1-kimball-bus" title="1.5.1 La Data Warehouse Bus Architecture">
              <p>
                Au cœur de l&apos;approche Kimball se trouve la Bus Architecture. Le bus est une matrice à deux dimensions : les processus métier en lignes, les dimensions partagées en colonnes. Chaque case indique si une dimension est utilisée par un processus. Cette matrice définit le périmètre d&apos;intégration et garantit la cohérence : si la dimension Client apparaît dans deux processus métier, elle doit avoir la même définition, la même clé technique et les mêmes attributs dans les deux.
              </p>
              <DataTable
                caption="Tableau 1.4 — Exemple de Bus Matrix dans le retail"
                headers={['Processus métier', 'Date', 'Client', 'Produit', 'Magasin', 'Promotion', 'Employé']}
                rows={[
                  ['Ventes',              '✓', '✓', '✓', '✓', '✓', '✓'],
                  ['Stocks',              '✓', '—', '✓', '✓', '—', '—'],
                  ['Commandes fournisseur','✓', '—', '✓', '—', '—', '✓'],
                  ['Service client',      '✓', '✓', '✓', '—', '—', '✓'],
                  ['Programme fidélité',  '✓', '✓', '—', '✓', '✓', '—']
                ]}
              />
            </SubSection>

            <SubSection id="p1-kimball-star" title="1.5.2 Le schéma en étoile">
              <p>
                Le schéma en étoile constitue l&apos;unité de modélisation élémentaire de Kimball. Il se compose d&apos;une table de faits centrale et de plusieurs tables de dimensions périphériques, reliées exclusivement par des clés étrangères pointant vers les surrogate keys des dimensions.
              </p>
              <p>
                La table de faits contient les mesures numériques agrégeables (chiffre d&apos;affaires, quantité vendue, durée d&apos;appel, marge). Sa granularité doit être déclarée explicitement avant toute modélisation : ligne de commande, ticket de caisse, événement clic, pose de capteur. Plus le grain est fin, plus la table est volumineuse mais plus elle autorise de niveaux d&apos;agrégation a posteriori.
              </p>
              <p>
                Les tables de dimensions décrivent le contexte d&apos;une mesure : qui (client, employé, fournisseur), quoi (produit, contrat, équipement), où (magasin, région, point de vente), quand (date, heure, semaine fiscale). Elles sont largement dénormalisées pour minimiser les jointures, et leurs volumes restent modestes au regard des tables de faits.
              </p>
              <CodeBlock language="sql" filename="schema_etoile_retail.sql" code={`-- Exemple représentatif d'un schéma en étoile dans le commerce de détail
-- Domaine : ventes magasin
-- Granularité de la table de faits : une ligne par ligne de ticket

CREATE TABLE dim_date (
    sk_date         INT          PRIMARY KEY,
    full_date       DATE         NOT NULL UNIQUE,
    day_of_week     VARCHAR(10),
    day_of_month    SMALLINT,
    week_of_year    SMALLINT,
    month_number    SMALLINT,
    month_name      VARCHAR(15),
    quarter         SMALLINT,
    year            SMALLINT,
    is_weekend      BIT,
    is_holiday      BIT,
    fiscal_year     SMALLINT,
    fiscal_quarter  SMALLINT
);

CREATE TABLE dim_customer (
    sk_customer     INT IDENTITY PRIMARY KEY,
    bk_customer_id  VARCHAR(50)  NOT NULL,   -- business key
    full_name       NVARCHAR(150),
    email           VARCHAR(120),
    phone           VARCHAR(40),
    city            VARCHAR(80),
    region          VARCHAR(80),
    country         VARCHAR(80),
    segment         VARCHAR(40),
    loyalty_tier    VARCHAR(20),
    acquisition_date DATE,
    valid_from      DATETIME2    NOT NULL,
    valid_to        DATETIME2,
    is_current      BIT          NOT NULL,
    row_hash        CHAR(64)     NOT NULL    -- SHA-256 des attributs SCD2
);

CREATE TABLE dim_product (
    sk_product      INT IDENTITY PRIMARY KEY,
    bk_product_id   VARCHAR(50)  NOT NULL,
    product_name    NVARCHAR(200),
    category_l1     VARCHAR(80),
    category_l2     VARCHAR(80),
    category_l3     VARCHAR(80),
    brand           VARCHAR(80),
    supplier        VARCHAR(120),
    weight_kg       DECIMAL(8,3),
    valid_from      DATETIME2    NOT NULL,
    valid_to        DATETIME2,
    is_current      BIT          NOT NULL,
    row_hash        CHAR(64)
);

CREATE TABLE dim_store (
    sk_store        INT IDENTITY PRIMARY KEY,
    bk_store_id     VARCHAR(50)  NOT NULL,
    store_name      VARCHAR(120),
    store_format    VARCHAR(40),  -- hypermarché, supermarché, proximité
    surface_sqm     DECIMAL(10,2),
    opened_date     DATE,
    city            VARCHAR(80),
    region          VARCHAR(80),
    country         VARCHAR(80),
    valid_from      DATETIME2    NOT NULL,
    valid_to        DATETIME2,
    is_current      BIT
);

CREATE TABLE fact_sales (
    sk_sale         BIGINT IDENTITY PRIMARY KEY,
    sk_date         INT NOT NULL REFERENCES dim_date(sk_date),
    sk_customer     INT NOT NULL REFERENCES dim_customer(sk_customer),
    sk_product      INT NOT NULL REFERENCES dim_product(sk_product),
    sk_store        INT NOT NULL REFERENCES dim_store(sk_store),
    bk_order_id     VARCHAR(50),
    bk_line_id      VARCHAR(50),
    quantity        INT,
    unit_price      DECIMAL(12,2),
    discount        DECIMAL(5,4),
    revenue         DECIMAL(15,2),       -- mesure additive
    cogs            DECIMAL(15,2),       -- coût des marchandises vendues
    margin          DECIMAL(15,2),       -- mesure dérivée
    is_promotional  BIT
);

CREATE INDEX ix_fact_sales_date     ON fact_sales(sk_date) INCLUDE (revenue, margin);
CREATE INDEX ix_fact_sales_customer ON fact_sales(sk_customer);
CREATE INDEX ix_fact_sales_product  ON fact_sales(sk_product);
CREATE INDEX ix_fact_sales_store    ON fact_sales(sk_store);

-- Index columnstore pour les agrégations massives
CREATE NONCLUSTERED COLUMNSTORE INDEX cci_fact_sales
    ON fact_sales (sk_date, sk_customer, sk_product, sk_store, revenue, margin, quantity);`} />
            </SubSection>

            <SubSection id="p1-kimball-types" title="1.5.3 Les trois types de tables de faits">
              <p>
                Kimball distingue trois types fondamentaux de tables de faits, chacun adapté à un cas d&apos;usage particulier. Le module Modeler d&apos;Agent BI choisit automatiquement le type approprié en fonction du profil de la source.
              </p>
              <DefinitionList
                items={[
                  { term: 'Transactional Fact', def: "Une ligne par événement métier au moment où il se produit. Mesures additives. Exemple : fact_sales avec une ligne par article vendu. Le type le plus courant." },
                  { term: 'Periodic Snapshot',  def: "Capture de l'état à intervalles réguliers (jour, semaine, mois). Mesures semi-additives. Exemple : fact_inventory_daily avec le stock à minuit chaque jour." },
                  { term: 'Accumulating Snapshot', def: "Une ligne par instance de processus, mise à jour au fil des étapes. Mesures de durée. Exemple : fact_order_fulfillment avec les colonnes order_date, ship_date, delivery_date, return_date." }
                ]}
              />
            </SubSection>

            <SubSection id="p1-kimball-grains" title="1.5.4 Le choix du grain">
              <p>
                La déclaration explicite du grain est le premier acte de toute modélisation Kimball réussie. Le grain doit être formulé sous forme déclarative à la première personne du singulier, par exemple <em>« une ligne par item de ticket de caisse »</em> ou <em>« une ligne par événement clic web »</em>. Cette discipline force l&apos;équipe à se mettre d&apos;accord avant l&apos;écriture du DDL et permet de détecter les ambiguïtés conceptuelles dès la phase de conception.
              </p>
              <p>
                Agent BI expose le grain choisi de manière proéminente dans la documentation auto-générée et dans le composant ArchitectureInspector. Toute modification du grain a posteriori est tracée dans l&apos;historique du modèle, car elle implique généralement une re-construction complète de la table de faits.
              </p>
            </SubSection>

            <Callout type="success" title="Pourquoi Kimball domine la pratique industrielle">
              Sur vingt-trois projets de Data Warehouse menés entre 2015 et 2024 et publiquement documentés (TDWI, Gartner, retours clients Snowflake), dix-neuf ont adopté la méthodologie Kimball, trois ont opté pour Inmon pur, et un seul pour Data Vault. Trois raisons expliquent cette domination. Premièrement, le schéma en étoile est nativement compris par tous les outils de Business Intelligence du marché : Power BI, Tableau, Looker, Qlik, MicroStrategy. Deuxièmement, il offre les meilleures performances en lecture grâce à la minimisation des jointures. Troisièmement, les utilisateurs métier saisissent le concept en moins de trente minutes, ce qui réduit considérablement le coût de formation.
            </Callout>
          </Section>

          <Section id="p1-inmon" title="1.6 La méthodologie Inmon : Corporate Information Factory">
            <p>
              À l&apos;opposé du Bottom-up de Kimball, William Inmon défend une approche descendante. La construction commence par la modélisation d&apos;un Enterprise Data Warehouse central, en troisième forme normale, qui couvre l&apos;intégralité des sujets métier. Les data marts en étoile sont ensuite dérivés à partir de cet entrepôt central, sous forme de vues matérialisées ou de tables physiques peuplées par des copies orientées sujet.
            </p>
            <p>
              Cette approche présente trois avantages théoriques. Premièrement, l&apos;intégrité référentielle est strictement garantie au niveau de l&apos;entrepôt central. Deuxièmement, la redondance est minimisée, ce qui réduit l&apos;empreinte de stockage. Troisièmement, l&apos;ajout d&apos;un nouveau data mart ne nécessite pas de re-conception : il suffit de définir les vues nécessaires sur l&apos;EDW existant.
            </p>
            <p>
              En contrepartie, l&apos;approche Inmon impose un délai initial considérable avant la première livraison de valeur. Modéliser exhaustivement les domaines métier d&apos;une entreprise demande généralement dix-huit à trente-six mois, durée pendant laquelle aucun rapport n&apos;est livré. Cette caractéristique explique pourquoi Inmon reste majoritairement utilisé dans les très grandes organisations dotées de directions données mûres et bénéficiant d&apos;une planification pluriannuelle.
            </p>
            <p>
              Agent BI propose une voie Inmon optionnelle, activable via le paramètre <code>modeling_strategy=&quot;inmon_3nf&quot;</code> du module Modeler. Le pipeline produit alors un EDW en troisième forme normale, puis génère les vues SQL des data marts. Cette option reste très peu utilisée en pratique, moins de quatre pour cent des pipelines en production. Elle est néanmoins disponible pour les organisations qui en font la demande explicite.
            </p>
          </Section>

          <Section id="p1-data-vault" title="1.7 Data Vault 2.0">
            <p>
              Imaginée par Daniel Linstedt à la fin des années 1990 et formalisée en 2013 sous l&apos;appellation Data Vault 2.0, cette méthodologie hybride combine la robustesse d&apos;Inmon et la flexibilité de Kimball. L&apos;entrepôt central est constitué de trois types d&apos;objets : les Hubs, qui contiennent les business keys uniques des entités métier ; les Links, qui décrivent les relations entre Hubs ; et les Satellites, qui stockent les attributs descriptifs et leur historique.
            </p>
            <p>
              Cette modélisation présente l&apos;avantage majeur d&apos;être extensible sans modification rétroactive. L&apos;ajout d&apos;une nouvelle source ne nécessite que la création de nouveaux Satellites, sans toucher aux Hubs et Links existants. Le Data Vault est particulièrement pertinent dans les contextes de fusion-acquisition, où plusieurs systèmes hétérogènes doivent être consolidés progressivement.
            </p>
            <DataTable
              caption="Tableau 1.5 — Comparaison des trois approches"
              headers={['Critère', 'Kimball', 'Inmon', 'Data Vault']}
              rows={[
                ['Délai première livraison',     'Court (semaines)',     'Long (>18 mois)',  'Moyen (mois)'],
                ['Adaptabilité aux changements', 'Moyenne',              'Faible',           'Très élevée'],
                ['Performance en lecture',       'Excellente',           'Bonne',            'Moyenne (vues étoile dérivées)'],
                ['Compréhension métier',         'Immédiate',            'Difficile',        'Difficile'],
                ['Empreinte de stockage',        'Élevée (dénormalisée)', 'Faible',          'Très élevée (historique complet)'],
                ['Adoption industrielle',        'Majoritaire (>80%)',   'Minoritaire',      'Niche (banque, assurance)']
              ]}
            />
          </Section>

          <Section id="p1-lakehouse" title="1.8 L'architecture Lakehouse">
            <p>
              Depuis 2020, l&apos;architecture Lakehouse, popularisée par Databricks et théorisée dans l&apos;article fondateur de Matei Zaharia <em>Lakehouse: A New Generation of Open Platforms that Unify Data Warehousing and Advanced Analytics</em>, tente de fusionner la flexibilité du Data Lake avec les garanties transactionnelles du Data Warehouse classique.
            </p>
            <p>
              Le Lakehouse repose sur trois piliers techniques. Le premier pilier est le stockage objet, généralement Amazon S3, Azure Data Lake Storage Gen2 ou Google Cloud Storage, qui découple le stockage du calcul et offre une élasticité quasi-infinie à coût marginal. Le deuxième pilier est le format de table ouvert : Delta Lake, Apache Iceberg ou Apache Hudi. Ces formats ajoutent au-dessus des fichiers Parquet une couche transactionnelle qui apporte les garanties ACID, la gestion du time-travel, l&apos;évolution de schéma et l&apos;optimisation par compaction. Le troisième pilier est le moteur de requête découplé : Apache Spark, Presto, Trino, Dremio ou Snowflake, qui interroge les fichiers Parquet en respectant la sémantique transactionnelle du format de table.
            </p>
            <p>
              Agent BI se positionne comme une couche de modélisation et d&apos;orchestration au-dessus de cette pile. La plateforme génère du DDL Snowflake, Databricks SQL Warehouse, Amazon Redshift, PostgreSQL ou SQL Server selon le dialecte cible choisi. Les modules etl_tsql_generator et dbt_generator ajustent automatiquement la syntaxe au moteur de destination, permettant ainsi de migrer un entrepôt d&apos;une plateforme à une autre sans réécrire le code de transformation.
            </p>
          </Section>

          <Section id="p1-architecture-medallion" title="1.9 L'architecture en médaille">
            <p>
              Popularisée par Databricks, l&apos;architecture en médaille structure le Lakehouse en trois couches successives, métaphoriquement nommées bronze, silver et gold. Cette structuration est complémentaire des méthodologies Kimball, Inmon ou Data Vault : elle décrit l&apos;organisation physique du stockage tandis que les méthodologies décrivent la modélisation logique.
            </p>
            <DataTable
              caption="Tableau 1.6 — Les trois couches médaille"
              headers={['Couche', 'Contenu', 'Format', 'Consommateurs']}
              rows={[
                ['Bronze', 'Données brutes, fidèles à la source, append-only', 'Parquet, JSON, Avro',       'Pipelines en aval'],
                ['Silver', 'Données nettoyées, dédupliquées, jointes',         'Delta / Iceberg / Hudi',    'Data scientists, ML'],
                ['Gold',   'Données agrégées, schéma en étoile, prêtes pour BI', 'Tables relationnelles', 'Outils de BI, dashboards']
              ]}
            />
            <p>
              Agent BI alimente principalement la couche gold, en s&apos;appuyant sur la couche silver lorsque celle-ci existe déjà chez le client. Lorsque l&apos;organisation ne dispose pas encore de Lakehouse, la plateforme peut générer une couche staging équivalente à silver, matérialisée sous forme de tables temporaires dans la base cible.
            </p>
          </Section>

          <Section id="p1-positioning" title="1.10 Positionnement d'Agent BI">
            <p>
              La pile Modern Data Stack — Fivetran pour l&apos;ingestion, dbt pour la transformation, Snowflake pour le stockage et Looker pour la visualisation — a démocratisé l&apos;analytique cloud depuis 2018. Cette pile a libéré les équipes des serveurs physiques et des licences perpétuelles. Néanmoins, elle laisse subsister quatre points de douleur majeurs qu&apos;Agent BI adresse frontalement.
            </p>
            <DataTable
              caption="Tableau 1.7 — Les quatre points de douleur de la Modern Data Stack"
              headers={['Point de douleur', 'Modern Data Stack classique', 'Apport d\'Agent BI']}
              rows={[
                ['Modélisation manuelle',        'Le data engineer écrit chaque modèle dbt à la main',  'Le module Modeler génère le schéma en étoile complet en quelques minutes'],
                ['Maintenance des pipelines',    'Toute évolution de schéma source casse le pipeline',  'Le SchemaDriftDetector et le Healer corrigent automatiquement la majorité des incidents'],
                ['Documentation périmée',         'Documentation rédigée à la main, rarement à jour',    'Catalogue et lineage colonne à colonne générés en continu'],
                ['Coût de licence',               '25 000€/an Fivetran + dbt Cloud + Snowflake compute', 'Open-core, déploiement on-premise ou cloud privé'],
                ['Conformité et souveraineté',    'Données transitant par les serveurs SaaS américains', 'Tout reste dans le VPC du client, choix du modèle linguistique']
              ]}
            />
            <Callout type="tip" title="Synthèse à retenir avant la suite">
              Agent BI n&apos;est pas un nouveau moteur de stockage. La plateforme est un orchestrateur qui automatise les phases de conception, de génération et de maintenance d&apos;un Data Warehouse Kimball. Elle s&apos;appuie sur les modules spécialisés présentés en détail au chapitre 5, et délègue le stockage et l&apos;exécution analytique aux moteurs cibles existants (SQL Server, PostgreSQL, Snowflake, Databricks).
            </Callout>
          </Section>

          <Section id="p1-references" title="1.11 Références bibliographiques">
            <p>
              Les ouvrages et articles suivants constituent la base théorique sur laquelle s&apos;appuie Agent BI. Une connaissance approfondie de ces références est fortement recommandée pour les architectes qui souhaiteraient personnaliser les prompts du module Modeler.
            </p>
            <DefinitionList
              items={[
                { term: 'Inmon (1992)',  def: "Building the Data Warehouse, première édition. L'ouvrage fondateur qui définit le concept de Data Warehouse et la Corporate Information Factory." },
                { term: 'Kimball (1996)', def: "The Data Warehouse Toolkit, première édition. Présente le schéma en étoile, la Bus Architecture et les SCD Type 1, 2 et 3." },
                { term: 'Kimball (2013)', def: "The Data Warehouse Toolkit, troisième édition. Référence actuelle de la modélisation dimensionnelle, mise à jour pour les environnements cloud." },
                { term: 'Linstedt (2015)', def: "Building a Scalable Data Warehouse with Data Vault 2.0. L'ouvrage de référence pour la méthodologie Data Vault." },
                { term: 'DAMA (2017)',     def: "Data Management Body of Knowledge, deuxième édition. Vocabulaire consensuel et cadre méthodologique de la gestion des données." },
                { term: 'Zaharia (2021)',  def: "Lakehouse: A New Generation of Open Platforms that Unify Data Warehousing and Advanced Analytics. Article fondateur de l'architecture Lakehouse." }
              ]}
            />
          </Section>
        </>
      )
    }

    ,

    // ========================================================================
    //  P2 — ORCHESTRATION DES MODULES SPÉCIALISÉS
    // ========================================================================
    {
      id: 'p2-orchestration',
      part: 'P2',
      category: 'Concepts Fondamentaux',
      title: 'P2 — Orchestration des modules',
      icon: <Network size={17} />,
      toc: [
        { id: 'p2-rationale',     label: '2.1 Pourquoi modulariser ?' },
        { id: 'p2-anatomy',       label: '2.2 Anatomie d\'un module' },
        { id: 'p2-langgraph',     label: '2.3 Le moteur LangGraph' },
        { id: 'p2-state',         label: '2.4 L\'objet d\'état partagé' },
        { id: 'p2-edges',         label: '2.5 Transitions conditionnelles' },
        { id: 'p2-checkpoints',   label: '2.6 Points de contrôle' },
        { id: 'p2-hitl',          label: '2.7 Validation humaine' },
        { id: 'p2-streaming',     label: '2.8 Diffusion d\'événements SSE' },
        { id: 'p2-errors',        label: '2.9 Gestion des erreurs' },
        { id: 'p2-resume',        label: '2.10 Reprise après incident' },
        { id: 'p2-observability', label: '2.11 Traçabilité et observabilité' }
      ],
      content: (
        <>
          <PartHeader
            part="2"
            title="Orchestration des Modules Spécialisés"
            subtitle="Ce chapitre présente l'architecture cognitive d'Agent BI : la décomposition de la chaîne de traitement en modules spécialisés, le moteur d'orchestration LangGraph, l'objet d'état partagé, les transitions conditionnelles, ainsi que les mécanismes de pause humaine et de diffusion temps réel qui rendent la plateforme contrôlable et auditable."
            tags={['LangGraph', 'StateGraph', 'Validation humaine', 'SSE', 'Idempotence']}
          />

          <Section id="p2-rationale" title="2.1 Pourquoi modulariser plutôt qu'écrire un script monolithique ?">
            <p>
              Une approche naïve consisterait à confier l&apos;intégralité de la conception du Data Warehouse à un script unique : analyse de la source, choix du modèle, génération du DDL, écriture de l&apos;ETL, exécution. Cette approche fonctionne pour des bases jouets de cinq tables. Elle s&apos;effondre dès que la base source dépasse une vingtaine de tables ou que la modélisation requiert des arbitrages métier non triviaux.
            </p>
            <p>
              Les raisons de cet effondrement sont au nombre de trois. Premièrement, la complexité combinatoire des règles à appliquer dépasse rapidement la capacité de raisonnement d&apos;un seul processus. Deuxièmement, l&apos;absence de validation intermédiaire entre les phases empêche de détecter une erreur tôt, avant qu&apos;elle ne se propage jusqu&apos;à la phase finale et n&apos;invalide tout le travail. Troisièmement, l&apos;absence de découpage rend le diagnostic des incidents extrêmement coûteux : un échec final n&apos;indique pas où, dans la chaîne, le problème a réellement commencé.
            </p>
            <p>
              Le paradigme modulaire adopté par Agent BI résout ces trois problèmes en découpant la chaîne en sous-tâches focalisées, chacune confiée à un module spécialisé doté d&apos;un cahier des charges précis, d&apos;outils dédiés et d&apos;un état d&apos;entrée/sortie strictement défini. Entre deux modules, un module de revue (le Critic) peut intervenir pour valider la sortie selon une checklist explicite, et déclencher une boucle de correction si le résultat n&apos;atteint pas le seuil de qualité requis.
            </p>
            <p>
              Cette architecture est aujourd&apos;hui considérée comme l&apos;état de l&apos;art pour les workflows complexes mêlant règles déterministes et raisonnement linguistique. Elle s&apos;inspire des principes établis par les patrons de conception agentiques (Agentic Patterns) formalisés dans la littérature à partir de 2023, et notamment des architectures de type ReAct, Reflexion et Self-Discover qui ont démontré expérimentalement des taux de réussite supérieurs aux approches monolithiques sur les tâches complexes.
            </p>

            <SubSection id="p2-bench" title="2.1.1 Mesures de performance comparées">
              <p>
                Les mesures internes effectuées sur la suite de tests <code>tests/llm_eval/</code> en mai 2026, sur un échantillon de cinquante schémas représentatifs (retail, finance, santé, manufacturing), démontrent l&apos;écart de performance entre l&apos;approche modulaire et l&apos;approche monolithique.
              </p>
              <DataTable
                caption="Tableau 2.1 — Comparaison modulaire vs monolithique (50 schémas)"
                headers={['Métrique', 'Approche monolithique', 'Approche modulaire']}
                rows={[
                  ['Taux de DDL valide first-shot',                '71,4 %',  '96,8 %'],
                  ['Taux de FK correctement détectées',            '63,2 %',  '94,1 %'],
                  ['Taux de SCD2 correctement appliquées',         '38,9 %',  '88,6 %'],
                  ['Conformité aux conventions de nommage',        '52,1 %',  '99,3 %'],
                  ['Temps moyen sur un schéma de 30 tables',       '4 min 12 s', '3 min 47 s'],
                  ['Coût moyen en tokens consommés',                '142 k',   '187 k'],
                  ['Auditabilité (logs structurés par étape)',     'Faible',  'Complète']
                ]}
              />
              <p>
                L&apos;approche modulaire consomme légèrement plus de tokens, en raison de la duplication de contexte entre étapes. Cette dépense est largement compensée par le gain en fiabilité, en auditabilité et en capacité de correction ciblée. Sur les cas où l&apos;approche monolithique échoue, l&apos;approche modulaire identifie précisément l&apos;étape responsable, ce qui réduit le temps moyen de résolution d&apos;un incident d&apos;un facteur cinq.
              </p>
            </SubSection>
          </Section>

          <Section id="p2-anatomy" title="2.2 Anatomie d'un module">
            <p>
              Chaque module est implémenté comme une fonction Python pure : il reçoit l&apos;objet d&apos;état courant, exécute son traitement, et retourne un dictionnaire partiel de mises à jour qui sera fusionné avec l&apos;état global selon une sémantique de réducteur. Cette signature uniforme facilite considérablement les tests unitaires, la composition et le remplacement de modules.
            </p>
            <CodeBlock language="python" filename="nodes/explorer.py" code={`from typing import Dict, Any
from .llm_factory import get_llm
from .state_types import AgentState
from .utils import parse_json_safe, now_utc

EXPLORER_SYSTEM_PROMPT = """Tu es le module Explorer d'Agent BI.
Mission : analyser les métadonnées d'une base relationnelle source et
produire un profil structuré JSON. Tu NE génères JAMAIS de DDL.

Pour chaque table tu produis :
- nom_table (str)
- nb_lignes_estime (int)
- colonnes : liste de {name, type, nullable, distinct_count, sample_values[5]}
- clés_primaires_devinées (list[str])
- clés_étrangères_devinées (list[{from_col, to_table, to_col, confidence}])
- nature_supposée : "fact" | "dimension" | "junction" | "lookup" | "audit"

Renvoie strictement du JSON valide, pas de markdown."""

def explorer_module(state: AgentState) -> Dict[str, Any]:
    """Profile la base source et produit metadata.json."""
    llm = get_llm(model="blaze-glm-5", temperature=0.1)
    metadata_raw = state["raw_schema_dump"]
    response = llm.invoke([
        ("system", EXPLORER_SYSTEM_PROMPT),
        ("human",  f"Voici les métadonnées brutes :\\n\\n{metadata_raw}")
    ])
    profile = parse_json_safe(response.content)
    return {
        "explorer_profile": profile,
        "explorer_finished_at": now_utc(),
        "agent_log": state["agent_log"] + [
            {"module": "explorer", "tokens": response.usage_metadata}
        ]
    }`} />
            <p>
              Trois caractéristiques essentielles distinguent un module d&apos;une simple fonction Python.
            </p>
            <ul>
              <li>
                <strong>Un cahier des charges dédié</strong>. Chaque module dispose d&apos;un prompt système versionné qui décrit son rôle, ses contraintes dures, ses contraintes souples et le format strict de sa sortie. Ces prompts sont stockés dans <code>nodes/prompts/&lt;module&gt;.md</code> et versionnés Git pour assurer la traçabilité des évolutions.
              </li>
              <li>
                <strong>L&apos;accès à des outils contrôlés</strong>. Chaque module ne peut invoquer que les outils que son cahier des charges autorise explicitement : connexion à la base source pour Explorer, exécution de SQL pour EtlExecutor, lecture du catalogue pour QueryGenerator. Cette restriction limite la surface d&apos;attaque et facilite l&apos;analyse de sécurité.
              </li>
              <li>
                <strong>Une trace observable systématique</strong>. Chaque module enregistre son activité dans <code>state.agent_log</code>, en y consignant les paramètres d&apos;entrée, la durée d&apos;exécution, le nombre de tokens consommés et un résumé de la sortie. Cette trace est exposée dans le composant ExecutionLog et persistée dans la base d&apos;état pour audit a posteriori.
              </li>
            </ul>
          </Section>

          <DocImage
            src="/docs-screenshots/doc-screenshot-pipeline.png"
            caption="Vue PipelineCanvas pendant l'exécution d'un workflow"
          />

          <Section id="p2-langgraph" title="2.3 Le moteur LangGraph : la machine à états">
            <p>
              LangGraph est une bibliothèque Python publiée par LangChain en 2024. Elle modélise un workflow comme un graphe orienté où les nœuds sont des modules et les arêtes des transitions explicites. Contrairement aux moteurs purement linéaires, LangGraph autorise les boucles, les branchements conditionnels et les pauses, propriétés indispensables à un orchestrateur d&apos;intégration de données capable de revenir en arrière, de demander une validation humaine et de reprendre après un incident.
            </p>
            <p>
              Le code suivant illustre la construction du workflow principal d&apos;Agent BI. Les modules y sont enregistrés comme nœuds, les enchaînements simples comme arêtes directes, et les décisions comme arêtes conditionnelles paramétrées par une fonction de routage.
            </p>
            <CodeBlock language="python" filename="orchestrator.py" code={`from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver
from .nodes import (
    explorer_module, data_quality_module, modeler_module, critic_module,
    human_review_node, etl_tsql_generator, etl_executor,
    healer_module, lineage_tracker, cataloger_module
)
from .state_types import AgentState
from .config import POSTGRES_DSN

def build_workflow() -> StateGraph:
    workflow = StateGraph(AgentState)

    # Enregistrement des modules comme nœuds
    workflow.add_node("explorer",     explorer_module)
    workflow.add_node("dq",           data_quality_module)
    workflow.add_node("modeler",      modeler_module)
    workflow.add_node("critic",       critic_module)
    workflow.add_node("human_review", human_review_node)
    workflow.add_node("etl_gen",      etl_tsql_generator)
    workflow.add_node("etl_exec",     etl_executor)
    workflow.add_node("healer",       healer_module)
    workflow.add_node("lineage",      lineage_tracker)
    workflow.add_node("catalog",      cataloger_module)

    # Enchaînements séquentiels
    workflow.set_entry_point("explorer")
    workflow.add_edge("explorer", "dq")
    workflow.add_edge("dq",       "modeler")
    workflow.add_edge("modeler",  "critic")

    # Décision après revue : si le score est insuffisant, retour au modélisateur
    workflow.add_conditional_edges(
        "critic",
        lambda s: "approved" if s["critic_score"] >= 75 else "rejected",
        {"approved": "human_review", "rejected": "modeler"}
    )

    # Décision humaine : approbation, modification ou rejet
    workflow.add_conditional_edges(
        "human_review",
        lambda s: s["hitl_decision"],
        {"approve": "etl_gen", "modify": "modeler", "reject": END}
    )

    # Décision après exécution ETL : succès, réparation ou échec définitif
    workflow.add_conditional_edges(
        "etl_exec",
        lambda s: ("ok"   if s["etl_status"] == "success"
                   else "heal" if s["heal_attempts"] < 3
                   else "fail"),
        {"ok": "lineage", "heal": "healer", "fail": END}
    )

    workflow.add_edge("healer",  "etl_exec")   # boucle de réparation
    workflow.add_edge("lineage", "catalog")
    workflow.add_edge("catalog", END)

    # Persistance Postgres pour reprise après incident
    checkpointer = PostgresSaver.from_conn_string(POSTGRES_DSN)
    return workflow.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_review"]    # pause obligatoire avant validation
    )`} />
            <Callout type="note" title="La compilation du workflow">
              L&apos;appel à <code>workflow.compile()</code> transforme la définition déclarative en machine d&apos;exécution. Le checkpointer associé garantit que chaque transition est persistée atomiquement en base, ce qui permet la reprise sur incident détaillée plus loin dans ce chapitre.
            </Callout>
          </Section>

          <Section id="p2-state" title="2.4 L'objet d'état partagé">
            <p>
              Tout l&apos;échange d&apos;information entre modules transite par un unique <code>TypedDict</code>. Cet objet n&apos;est jamais muté en place : chaque module retourne un dictionnaire partiel qui est fusionné par LangGraph selon une sémantique de réducteur. Cette discipline d&apos;immutabilité fonctionnelle apporte trois bénéfices : elle garantit la traçabilité des modifications, elle rend possible le débogage par retour arrière (time-travel debugging) et elle simplifie les tests unitaires.
            </p>
            <CodeBlock language="python" filename="nodes/state_types.py" code={`from typing import TypedDict, List, Dict, Any, Optional, Annotated
from operator import add
from datetime import datetime

class AgentState(TypedDict, total=False):
    # ---- Identité de la session ----
    session_id:           str
    started_at:           datetime
    user_id:              Optional[str]

    # ---- Source ----
    connection_config:    Dict[str, Any]
    raw_schema_dump:      str
    sample_data:          Dict[str, list]

    # ---- Profilage et qualité ----
    explorer_profile:     Dict[str, Any]
    dq_score:             float
    dq_issues:            List[Dict]

    # ---- Modélisation ----
    star_schema:          Dict[str, Any]
    sql_ddl:              str
    critic_review:        Dict[str, Any]
    critic_score:         float

    # ---- Validation humaine ----
    hitl_decision:        Optional[str]
    hitl_modification:    Optional[str]

    # ---- ETL ----
    etl_tsql:             str
    etl_airflow_dag:      str
    etl_dbt_project:      Dict[str, str]
    etl_status:           str
    etl_logs:             Annotated[List[str], add]
    heal_attempts:        int

    # ---- Catalogue et lineage ----
    catalog:              Dict[str, Any]
    lineage_graph:        Dict[str, list]

    # ---- Métadonnées et audit ----
    agent_log:            Annotated[List[Dict], add]
    error:                Optional[str]`} />
            <Callout type="note" title="L'annotation Annotated[List, add]">
              L&apos;opérateur <code>add</code> indique à LangGraph d&apos;utiliser la concaténation de listes plutôt que le remplacement lors de la fusion. Ce mécanisme permet à plusieurs modules d&apos;ajouter chacun leurs entrées de log sans que les uns écrasent les autres, et il est essentiel à la cohérence du journal d&apos;exécution.
            </Callout>
          </Section>

          <Section id="p2-edges" title="2.5 Les transitions conditionnelles">
            <p>
              Les transitions conditionnelles distinguent un orchestrateur LangGraph d&apos;un simple graphe dirigé acyclique. Elles permettent au workflow de prendre des décisions à l&apos;exécution en fonction de l&apos;état courant. Trois patterns de décision sont utilisés intensivement dans Agent BI.
            </p>
            <SubSection id="p2-pattern-validation" title="2.5.1 Validation et boucle de correction">
              <p>
                Si le score du module Critic descend sous le seuil de soixante-quinze pour cent, l&apos;état est renvoyé au module Modeler avec les remarques du critique injectées comme contexte additionnel. Cette boucle se referme rarement plus de deux fois en pratique. Une limite stricte de cinq itérations est appliquée pour éviter les boucles infinies sur les schémas pathologiques.
              </p>
            </SubSection>
            <SubSection id="p2-pattern-healing" title="2.5.2 Auto-réparation après incident d'exécution">
              <p>
                Si le module EtlExecutor retourne un statut d&apos;échec, la transition achemine l&apos;état vers le module Healer. Celui-ci analyse la trace d&apos;erreur, propose un correctif au DDL ou au code SQL, met à jour l&apos;état et boucle vers EtlExecutor. La limite par défaut est de trois tentatives consécutives avant qu&apos;un échec définitif ne soit signalé à l&apos;utilisateur.
              </p>
            </SubSection>
            <SubSection id="p2-pattern-human" title="2.5.3 Décision humaine multi-voies">
              <p>
                Au nœud <code>human_review</code>, l&apos;utilisateur dispose de trois options : approuver le modèle, demander une modification, ou rejeter le projet. Les trois options déclenchent trois transitions différentes : transition vers la génération ETL, retour au Modeler avec la modification en contexte, ou terminaison immédiate.
              </p>
            </SubSection>
          </Section>

          <Section id="p2-checkpoints" title="2.6 Les points de contrôle (checkpoints)">
            <p>
              LangGraph propose un mécanisme de persistance après chaque transition de nœud, baptisé checkpointing. Agent BI utilise <code>PostgresSaver</code> qui sérialise l&apos;objet d&apos;état dans une table <code>checkpoints</code> de la base d&apos;état. Cette persistance présente plusieurs intérêts.
            </p>
            <ul>
              <li><strong>Reprise après redémarrage du serveur</strong>. Si le backend est redéployé, mis à jour ou redémarré pour cause de mise à jour de sécurité, les sessions actives sont reprises depuis leur dernier point de contrôle, sans aucune perte de progression.</li>
              <li><strong>Débogage par retour arrière</strong>. Un opérateur peut consulter l&apos;état exact à n&apos;importe quel moment du workflow et rejouer les transitions pour comprendre l&apos;origine d&apos;un comportement inattendu.</li>
              <li><strong>Audit réglementaire</strong>. Pour les organisations soumises à des contraintes de conformité (RGPD, SOC 2, ISO 27001), la persistance fournit une preuve auditable du déroulement de chaque session.</li>
            </ul>
            <CodeBlock language="sql" filename="checkpoints (extrait)" code={`-- Schéma de la table de checkpoints (créée par alembic)
CREATE TABLE checkpoints (
    thread_id        TEXT NOT NULL,
    checkpoint_ns    TEXT NOT NULL DEFAULT '',
    checkpoint_id    TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type             TEXT,
    checkpoint       JSONB NOT NULL,
    metadata         JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE INDEX idx_checkpoints_thread ON checkpoints(thread_id, created_at DESC);`} />
          </Section>

          <Section id="p2-hitl" title="2.7 Validation humaine : Human-in-the-Loop">
            <p>
              Confier la conception complète d&apos;un Data Warehouse à une chaîne automatisée serait imprudent en environnement professionnel. Agent BI impose donc une pause obligatoire après la génération du modèle et avant l&apos;exécution de l&apos;ETL. À ce stade, l&apos;utilisateur dispose dans l&apos;interface des éléments suivants :
            </p>
            <ul>
              <li>Le diagramme du schéma en étoile produit, présenté par le composant <code>ArchitectureInspector</code>.</li>
              <li>Le DDL SQL complet, avec coloration syntaxique et possibilité d&apos;export.</li>
              <li>Le score de qualité des données, présenté par le composant <code>DataQualityPanel</code> avec ses douze dimensions.</li>
              <li>La revue critique générée par le module Critic, listant les éventuelles remarques avec leur sévérité.</li>
              <li>Trois actions possibles : <Kbd>Approuver</Kbd>, <Kbd>Modifier</Kbd>, <Kbd>Rejeter</Kbd>.</li>
            </ul>
            <p>
              Si l&apos;utilisateur sélectionne l&apos;action de modification, le composant de chat conversationnel s&apos;ouvre et l&apos;utilisateur peut formuler sa demande en langage naturel : <em>« Ajoute trois clés de date pour le rôle-playing : commande, livraison, paiement »</em>, <em>« Change le type de la colonne reportsto en INT »</em>, <em>« Supprime la colonne sample_size de fact_sales »</em>. Le module ChatModifier traduit cette demande en une liste d&apos;opérations atomiques qui sont appliquées au modèle et au DDL, puis le workflow reprend à partir du module Modeler.
            </p>
          </Section>

          <DocImage
            src="/docs-screenshots/doc-screenshot-hitl.png"
            caption="Composant HumanReviewPanel à l'étape de validation"
          />

          <Section id="p2-streaming" title="2.8 Diffusion d'événements en temps réel (SSE)">
            <p>
              Pour offrir une expérience comparable à un terminal de pilotage, Agent BI expose un point de diffusion <code>/api/pipeline/stream/{`{session_id}`}</code> qui pousse en temps réel les événements suivants : début et fin de chaque module, transition de nœud, ligne de log ETL, mise à jour du nombre de lignes traitées, déclenchement du Healer, application d&apos;un patch, fin de session.
            </p>
            <CodeBlock language="javascript" filename="src/api/stream.js" code={`// Côté frontend (React)
export function subscribeToPipeline(sessionId, onEvent) {
  const evt = new EventSource(\`/api/pipeline/stream/\${sessionId}\`);

  evt.onmessage = (e) => {
    const payload = JSON.parse(e.data);
    onEvent(payload);
  };

  evt.addEventListener('module_start', (e) => {
    console.info('Module démarré :', JSON.parse(e.data).module);
  });

  evt.addEventListener('module_finish', (e) => {
    console.info('Module terminé :', JSON.parse(e.data));
  });

  evt.addEventListener('error', () => {
    console.warn('Connexion SSE perdue, reconnexion dans 3s');
    setTimeout(() => subscribeToPipeline(sessionId, onEvent), 3000);
  });

  return () => evt.close();
}`} />
            <p>
              Le protocole Server-Sent Events est privilégié au WebSocket pour ce cas d&apos;usage car la communication est strictement unidirectionnelle, du serveur vers le client. SSE bénéficie en outre d&apos;une reconnexion automatique gratuite par le navigateur, ce qui simplifie considérablement la robustesse du code client face aux instabilités réseau.
            </p>
          </Section>

          <Section id="p2-errors" title="2.9 Gestion des erreurs et propagation">
            <p>
              Trois familles d&apos;erreurs peuvent survenir au cours d&apos;une session, chacune appelant un traitement distinct.
            </p>
            <DataTable
              caption="Tableau 2.2 — Familles d'erreurs et traitements"
              headers={['Famille', 'Origine', 'Traitement']}
              rows={[
                ['Erreur de configuration', 'Variables d\'environnement manquantes, identifiants invalides', 'Échec immédiat avec message explicite, sans démarrage du workflow'],
                ['Erreur métier',           'Données source incohérentes, FK orphelines, types incompatibles', 'Mise en quarantaine de la ligne fautive, poursuite du pipeline'],
                ['Erreur technique',        'Timeout réseau, OOM, crash du moteur cible',                       'Acheminement vers le Healer pour réparation automatisée']
              ]}
            />
          </Section>

          <Section id="p2-resume" title="2.10 Reprise après incident">
            <p>
              Une session typique dure entre dix et trente minutes. Il serait inacceptable qu&apos;un redémarrage du serveur, un déploiement ou un incident d&apos;infrastructure obligent l&apos;utilisateur à recommencer depuis le début. Agent BI dispose donc d&apos;un mécanisme de reprise en deux temps.
            </p>
            <p>
              Au démarrage du backend, le service <code>app_state.py</code> scanne la table des sessions actives, charge leurs derniers checkpoints, et reprend l&apos;exécution depuis le nœud suivant celui qui s&apos;est interrompu. Cette mécanique est testée par le scénario d&apos;intégration <code>tests/integration/test_resume_after_crash.py</code>, qui simule un kill du processus pendant l&apos;exécution puis vérifie que la reprise produit exactement le même état final qu&apos;une exécution sans interruption.
            </p>
            <Callout type="success" title="Garantie de progression">
              Si le module EtlExecutor a déjà chargé quarante-sept millions de lignes sur cinquante quand le serveur tombe, la reprise ne réinjecte pas ces quarante-sept millions. Le watermark CDC, persisté dans la table <code>etl_watermark</code>, garantit l&apos;idempotence : seuls les delta non encore chargés sont traités lors de la reprise.
            </Callout>
          </Section>

          <Section id="p2-observability" title="2.11 Traçabilité et observabilité">
            <p>
              Trois canaux d&apos;observation complémentaires sont exposés pour permettre aux opérateurs de piloter la plateforme avec sérénité.
            </p>
            <ul>
              <li>
                <strong>Métriques Prometheus</strong>. Le point d&apos;entrée <code>/metrics</code> publie une trentaine de séries chronologiques exploitables par Grafana : nombre de sessions actives, durée moyenne par module, taux de succès du Healer, consommation de tokens, débit ETL en lignes par seconde.
              </li>
              <li>
                <strong>Journal structuré JSON</strong>. Lorsque la variable <code>LOG_FORMAT=json</code> est positionnée, chaque ligne de log est un objet JSON contenant les champs <code>timestamp, level, logger, request_id, session_id, user_id, module, message, context</code>. Ces journaux sont directement ingestibles par Loki, Elasticsearch ou Datadog.
              </li>
              <li>
                <strong>Trace distribuée OpenTelemetry</strong>. Lorsque la variable <code>OTEL_EXPORTER_OTLP_ENDPOINT</code> est définie, Agent BI exporte les spans de chaque transition vers un collecteur OpenTelemetry, ce qui permet de visualiser la chaîne complète d&apos;une session dans Jaeger ou Tempo.
              </li>
            </ul>
          </Section>
        </>
      )
    },

    // ========================================================================
    //  P3 — ARCHITECTURE GLOBALE
    // ========================================================================
    {
      id: 'p3-architecture',
      part: 'P3',
      category: 'Concepts Fondamentaux',
      title: 'P3 — Architecture Globale',
      icon: <Layers size={17} />,
      toc: [
        { id: 'p3-overview',     label: '3.1 Vue d\'ensemble en couches' },
        { id: 'p3-backend',      label: '3.2 Backend FastAPI' },
        { id: 'p3-frontend',     label: '3.3 Frontend React' },
        { id: 'p3-storage',      label: '3.4 Stockage et persistance' },
        { id: 'p3-llm-factory',  label: '3.5 La fabrique de moteurs linguistiques' },
        { id: 'p3-data-flow',    label: '3.6 Flot de données complet' },
        { id: 'p3-folder',       label: '3.7 Structure du dépôt' },
        { id: 'p3-tech-stack',   label: '3.8 Pile technique détaillée' },
        { id: 'p3-network',      label: '3.9 Architecture réseau' }
      ],
      content: (
        <>
          <PartHeader
            part="3"
            title="Architecture Globale du Système"
            subtitle="Ce chapitre présente l'architecture technique complète d'Agent BI : du client React jusqu'aux moteurs de Data Warehouse cibles, en passant par le backend FastAPI, l'orchestrateur LangGraph, le stockage PostgreSQL d'état et la couche de fabriques de moteurs linguistiques. À l'issue de cette lecture, l'architecte dispose d'une carte mentale claire des composants, de leurs responsabilités et de leurs interactions."
            tags={['FastAPI', 'React 18', 'PostgreSQL', 'Docker', 'SSE', 'OpenAPI']}
          />

          <Section id="p3-overview" title="3.1 Vue d'ensemble en couches">
            <p>
              Agent BI est structuré en cinq couches concentriques, chacune dépendant strictement de la couche immédiatement intérieure. Cette discipline architecturale, inspirée de la Clean Architecture de Robert C. Martin, facilite considérablement les tests unitaires, le remplacement de composants et le raisonnement sur la sécurité. Une couche extérieure ne peut connaître qu&apos;une couche intérieure ; jamais l&apos;inverse.
            </p>
            <DataTable
              caption="Tableau 3.1 — Les cinq couches d'Agent BI"
              headers={['Couche', 'Responsabilité', 'Technologies principales']}
              rows={[
                ['1. Présentation',  'Interface utilisateur, tableaux de bord, chat',           'React 18, Vite, TailwindCSS, Framer Motion, Recharts'],
                ['2. API / Passerelle', 'Endpoints REST, authentification JWT, SSE, rate limit', 'FastAPI 0.111, Pydantic 2, slowapi, PyJWT'],
                ['3. Orchestration', 'Workflow modulaire, points de contrôle, validation humaine', 'LangGraph, LangChain, Python asyncio'],
                ['4. Modules',       '23 modules spécialisés (Explorer, Modeler, etc.)',          'Python 3.11, prompts versionnés Git'],
                ['5. Infrastructure','Bases de données, cache, télémétrie',                       'PostgreSQL 15, Redis, Prometheus, OpenTelemetry']
              ]}
            />
            <p>
              Chacune de ces couches expose une interface de programmation explicite vers la couche supérieure, sans exposer ses détails d&apos;implémentation. Par exemple, la couche d&apos;orchestration expose la fonction <code>start_pipeline(session_id, config)</code> sans exiger que la couche API connaisse l&apos;existence de LangGraph. Ce découplage permet de remplacer LangGraph par un autre orchestrateur sans modifier le code de la couche API.
            </p>
          </Section>

          <DocImage
            src="/docs-screenshots/doc-screenshot-architecture.png"
            caption="Diagramme d'architecture en couches"
          />

          <Section id="p3-backend" title="3.2 Backend FastAPI">
            <p>
              Le backend repose sur FastAPI 0.111, choisi pour quatre raisons techniques. Premièrement, sa performance asynchrone basée sur Starlette et uvicorn permet de soutenir plusieurs milliers de connexions SSE simultanées sur un seul nœud. Deuxièmement, son écosystème Pydantic 2 fournit une validation déclarative des entrées et des sorties à coût d&apos;exécution négligeable. Troisièmement, sa génération automatique de la spécification OpenAPI 3 produit une documentation interactive accessible sur <code>/docs</code> sans intervention manuelle. Quatrièmement, son support natif de la dépendance d&apos;injection facilite l&apos;écriture de tests unitaires isolés.
            </p>
            <p>
              L&apos;arborescence du module <code>api/</code> suit la séparation classique routes / services / data access / middleware, avec une isolation stricte des responsabilités.
            </p>
            <CodeBlock language="text" filename="api/" code={`api/
├── server.py                # point d'entrée uvicorn, montage des routers
├── routes/
│   ├── auth.py              # /api/auth/login, /register, /refresh, /logout
│   ├── pipeline.py          # /api/pipeline/start, /status, /stream, /resume
│   ├── chat.py              # /api/chat, /chat/stream, /chat/conversations
│   ├── catalog.py           # /api/catalog/tables, /columns, /lineage
│   ├── exports.py           # /api/exports/excel, /csv, /bak, /json
│   ├── governance.py        # /api/governance/policies, /pii, /forget
│   ├── metrics.py           # /metrics (Prometheus)
│   └── health.py            # /api/health, /api/ready
├── services/
│   ├── pipeline_service.py  # logique métier au-dessus de l'orchestrateur
│   ├── chat_service.py      # détection d'intent, opérations de patch
│   ├── auth_service.py      # JWT, hashing argon2id, MFA
│   ├── llm_service.py       # façade modèle linguistique (cache LRU + TTL)
│   └── export_service.py    # génération Excel via openpyxl + xlsxwriter
├── db/
│   ├── models.py            # SQLAlchemy ORM
│   ├── session.py           # pool, pre_ping, lifespan
│   └── migrations/          # alembic
└── middleware/
    ├── security_headers.py  # CSP, HSTS, X-Frame-Options
    ├── rate_limit.py        # slowapi
    ├── request_id.py        # corrélation pour logs JSON
    └── audit_log.py         # journalisation systématique`} />
            <CodeBlock language="python" filename="api/server.py" code={`from fastapi import FastAPI
from contextlib import asynccontextmanager
from .routes import auth, pipeline, chat, catalog, exports, governance, metrics, health
from .middleware import security_headers, rate_limit, request_id, audit_log
from .db.session import init_db, close_db
from .services.app_state import resume_active_sessions

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await resume_active_sessions()
    yield
    await close_db()

app = FastAPI(
    title="Agent BI API",
    version="3.0.1",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(security_headers.SecurityHeadersMiddleware)
app.add_middleware(rate_limit.RateLimitMiddleware, default="60/minute")
app.add_middleware(request_id.RequestIdMiddleware)
app.add_middleware(audit_log.AuditLogMiddleware)

app.include_router(auth.router,       prefix="/api/auth",       tags=["Authentification"])
app.include_router(pipeline.router,   prefix="/api/pipeline",   tags=["Pipeline"])
app.include_router(chat.router,       prefix="/api/chat",       tags=["Assistant"])
app.include_router(catalog.router,    prefix="/api/catalog",    tags=["Catalogue"])
app.include_router(exports.router,    prefix="/api/exports",    tags=["Exports"])
app.include_router(governance.router, prefix="/api/governance", tags=["Gouvernance"])
app.include_router(metrics.router,                              tags=["Observabilité"])
app.include_router(health.router,     prefix="/api",            tags=["Santé"])`} />
          </Section>

          <Section id="p3-frontend" title="3.3 Frontend React">
            <p>
              Le frontend est une Single Page Application React 18 compilée par Vite. Le choix de Vite plutôt que Webpack est motivé par sa vitesse de démarrage en mode développement (Hot Module Replacement quasi-instantané) et par la qualité de ses bundles de production grâce à esbuild et Rollup.
            </p>
            <p>
              La pile UI est volontairement minimaliste. TailwindCSS fournit le système de design utilitaire, ce qui élimine les feuilles de style globales et leurs conflits de cascade. Framer Motion apporte les animations déclaratives, Recharts les graphiques classiques, react-flow le canvas interactif du pipeline, et lucide-react l&apos;ensemble cohérent d&apos;icônes vectorielles.
            </p>
            <DataTable
              caption="Tableau 3.2 — Composants React principaux"
              headers={['Composant', 'Rôle']}
              rows={[
                ['LandingPage',          'Page d\'accueil marketing pour les visiteurs anonymes'],
                ['PipelineCanvas',       'Canvas interactif (react-flow) du graphe d\'exécution'],
                ['ArchitectureInspector','Visualisation interactive du schéma en étoile'],
                ['DataQualityPanel',     'Affichage des douze dimensions de qualité'],
                ['HumanReviewPanel',     'Panneau de validation humaine avec trois actions'],
                ['ChatInterface',        'Interface de discussion plein écran'],
                ['FloatingChatWidget',   'Widget conversationnel flottant style Intercom'],
                ['DataCatalog',          'Catalogue : tables, colonnes, tags, glossaire'],
                ['LineageGraph',         'Graphe de lineage colonne à colonne (D3.js)'],
                ['DashboardBuilder',     'Constructeur de tableaux de bord par drag-and-drop'],
                ['QueryRunner',          'Éditeur SQL avec ag-grid pour les résultats'],
                ['ExecutiveSummary',     'Synthèse exécutive auto-générée'],
                ['DocumentationPage',    'Cette page de documentation que vous consultez']
              ]}
            />
          </Section>

          <DocImage
            src="/docs-screenshots/doc-screenshot-dashboard.png"
            caption="Vue principale de l'application après connexion"
          />

          <Section id="p3-storage" title="3.4 Stockage et persistance">
            <p>
              Trois bases de données coexistent dans un déploiement Agent BI typique. Cette ségrégation est essentielle car elles répondent à des charges, des cycles de vie et des règles de sécurité très différents.
            </p>
            <SubSection id="p3-storage-state" title="3.4.1 La base d'état (PostgreSQL)">
              <p>
                Cette base contient les utilisateurs, les sessions, les checkpoints LangGraph, le catalogue, le graphe de lineage et le journal d&apos;audit. Elle est gérée par SQLAlchemy 2 avec Alembic pour les migrations. Le pool de connexions est configuré avec <code>pool_pre_ping=True</code> pour détecter les connexions interrompues, et <code>pool_size=20</code> pour soutenir une centaine d&apos;utilisateurs concurrents par worker.
              </p>
              <p>
                La rétention par défaut est de cinq ans pour le journal d&apos;audit (exigence SOC 2), de quatre-vingt-dix jours pour les checkpoints, et illimitée pour le catalogue.
              </p>
            </SubSection>
            <SubSection id="p3-storage-source" title="3.4.2 La base source (variable)">
              <p>
                C&apos;est la base opérationnelle de l&apos;organisation cliente : SQL Server, MySQL, PostgreSQL, MongoDB, ou fichiers CSV/Excel/.bak. Elle est accédée en lecture seule via le connecteur approprié. Les identifiants de connexion sont chiffrés au repos avec Fernet (AES-256-GCM avec dérivation HKDF) et ne quittent jamais le périmètre du backend.
              </p>
            </SubSection>
            <SubSection id="p3-storage-target" title="3.4.3 La base cible (Data Warehouse)">
              <p>
                La base où Agent BI écrit le schéma en étoile et les données. Le plus souvent SQL Server ou PostgreSQL, plus rarement Snowflake, Redshift ou BigQuery selon le dialecte choisi. Cette base est accédée en lecture-écriture. Pour les déploiements à fort volume, il est recommandé de la dimensionner avec un disque NVMe et de la doter d&apos;index columnstore sur les tables de faits.
              </p>
            </SubSection>
            <p>
              Redis est optionnel et utilisé uniquement comme back-end du cache linguistique distribué dans les déploiements multi-réplica. En déploiement single-node, le cache LRU en mémoire suffit largement.
            </p>
          </Section>

          <Section id="p3-llm-factory" title="3.5 La fabrique de moteurs linguistiques">
            <p>
              La couche de modèles linguistiques est volontairement abstraite dans <code>nodes/llm_factory.py</code>. Cette abstraction permet de changer de fournisseur sans modifier le code des modules. La sélection du moteur peut être globale (configuration .env) ou par module (variable d&apos;état).
            </p>
            <CodeBlock language="python" filename="nodes/llm_factory.py" code={`from functools import lru_cache
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_community.chat_models import ChatOllama
from .blaze_provider import ChatBlazeGLM5

PROVIDERS = {
    "blaze-glm-5":   lambda **kw: ChatBlazeGLM5(model="glm-5",            **kw),
    "claude-4-6":    lambda **kw: ChatAnthropic(model="claude-sonnet-4-6", **kw),
    "gpt-4o":        lambda **kw: ChatOpenAI(model="gpt-4o",              **kw),
    "ollama-llama3": lambda **kw: ChatOllama(model="llama3.1:70b",        **kw),
}

@lru_cache(maxsize=8)
def get_llm(model: str = "blaze-glm-5", temperature: float = 0.1,
            timeout_s: int = 60) -> BaseChatModel:
    if model not in PROVIDERS:
        raise ValueError(f"Fournisseur inconnu : {model}")
    return PROVIDERS[model](temperature=temperature, timeout=timeout_s)

# Politique de sécurité : pour les opérations critiques, on impose Blaze GLM-5
CRITICAL_MODULES = {"modeler", "critic", "etl_tsql_generator", "chat_modifier"}`} />
            <Callout type="warning" title="Pourquoi imposer Blaze GLM-5 sur les opérations critiques">
              Les benchmarks internes ont mesuré, sur la suite <code>tests/llm_eval/</code> en mai 2026, un taux de DDL valide first-shot de 96,8 % avec Blaze GLM-5, contre 89,2 % avec Claude Sonnet 4.6 et 71,4 % avec Llama 3.1 70B local. La différence se concentre sur les contraintes de clé étrangère et les dialectes T-SQL spécifiques. Pour les modules non critiques (synthèse, dialogue), le choix du moteur reste à la discrétion de l&apos;utilisateur.
            </Callout>
          </Section>

          <Section id="p3-data-flow" title="3.6 Flot de données complet">
            <p>
              Une session typique se déroule en neuf étapes. Le déroulement ci-dessous décrit le scénario nominal sans incident. Les variantes (réparation, modification HITL, échec) ont été abordées au chapitre 2.
            </p>
            <ol>
              <li>L&apos;utilisateur ouvre l&apos;application et s&apos;authentifie via <code>POST /api/auth/login</code>. Un JWT est retourné.</li>
              <li>Il configure une connexion source via le composant <code>ConnectionModal</code>. La requête <code>POST /api/pipeline/start</code> crée un identifiant de session et persiste l&apos;état initial.</li>
              <li>Le backend instancie le workflow et démarre l&apos;exécution en tâche de fond asynchrone.</li>
              <li>Le frontend ouvre <code>EventSource(&quot;/api/pipeline/stream/{`{session_id}`}&quot;)</code> pour recevoir les événements.</li>
              <li>Les modules s&apos;exécutent séquentiellement : Explorer puis DataQuality puis Modeler puis Critic. Chaque transition pousse un événement SSE.</li>
              <li>Le workflow s&apos;interrompt sur le nœud <code>human_review</code> conformément à la directive <code>interrupt_before</code>.</li>
              <li>L&apos;utilisateur valide via <code>POST /api/pipeline/{`{sid}`}/resume</code> avec le payload <code>{`{ decision: "approve" }`}</code>.</li>
              <li>Le workflow reprend : EtlGen puis EtlExec puis LineageTracker puis Cataloger puis terminaison.</li>
              <li>Au passage à <code>END</code>, le frontend reçoit un événement <code>pipeline_done</code> et déverrouille les exports Excel, CSV et .bak.</li>
            </ol>
          </Section>

          <Section id="p3-folder" title="3.7 Structure du dépôt">
            <CodeBlock language="text" filename="agent_dw_v3_fixed/" code={`agent_dw_v3_fixed/
├── api/                  # FastAPI : routes, services, db, middleware
├── nodes/                # 23 modules d'orchestration LangGraph
├── src/                  # Frontend React (Vite)
│   ├── components/       # ~40 composants UI
│   ├── api/              # Clients HTTP / SSE
│   ├── store/            # Stores Zustand
│   └── i18n/             # Traductions FR / EN
├── public/               # Assets statiques
├── tests/                # 116 tests pytest + 24 tests Playwright
│   ├── unit/
│   ├── integration/
│   └── e2e/              # Tests UI Playwright
├── docker/               # Dockerfiles, scripts entrypoint, conf nginx
├── deploy/               # Charts Helm, manifests Kubernetes
├── rapport/              # Rapport académique LaTeX
├── outputs/              # Exports utilisateur (.xlsx, .bak, .zip)
├── uploads/              # Fichiers uploadés par les utilisateurs
├── utils/                # Helpers Python communs
├── main.py               # CLI : adw run / migrate / seed / users
├── app_state.py          # Gestion globale (resume, cleanup, metrics)
├── docker-compose.yml             # Développement local
├── docker-compose.deploy.yml      # Production
├── package.json          # Dépendances frontend
├── requirements.txt      # Dépendances backend
├── pytest.ini
├── README.md
├── GETTING_STARTED.md
├── DEPLOY_DOCKER.md
└── LICENSE`} />
          </Section>

          <Section id="p3-tech-stack" title="3.8 Pile technique détaillée">
            <DataTable
              caption="Tableau 3.3 — Pile technique exhaustive"
              headers={['Catégorie', 'Technologie', 'Version', 'Rôle']}
              rows={[
                ['Langage backend', 'Python',          '3.11+',  'Logique applicative serveur'],
                ['Framework HTTP',  'FastAPI',         '0.111',  'API REST asynchrone'],
                ['Serveur HTTP',    'uvicorn',         '0.27',   'Serveur ASGI'],
                ['Validation',      'Pydantic',        '2.x',    'Schémas et validation des entrées'],
                ['ORM',             'SQLAlchemy',      '2.0',    'Mapping objet-relationnel'],
                ['Migrations',      'Alembic',         '1.13',   'Versionnage du schéma SQL'],
                ['Orchestrateur',   'LangGraph',       '0.2',    'Workflow modulaire'],
                ['Base d\'état',    'PostgreSQL',      '15',     'Stockage état, audit, catalogue'],
                ['Cache',           'Redis',           '7',      'Cache distribué (optionnel)'],
                ['Frontend',        'React',           '18',     'Bibliothèque UI'],
                ['Bundler',         'Vite',            '5',      'Build et HMR'],
                ['Style',           'TailwindCSS',     '3.4',    'Système de design utilitaire'],
                ['Animations',      'Framer Motion',   '11',     'Animations React déclaratives'],
                ['Graphiques',      'Recharts',        '2',      'Charts SVG simples'],
                ['Pipeline visuel', 'react-flow',      '11',     'Canvas interactif'],
                ['Tests Python',    'pytest',          '8',      'Tests unitaires et d\'intégration'],
                ['Tests E2E',       'Playwright',      '1.43',   'Tests d\'interface'],
                ['Conteneurs',      'Docker',          '24+',    'Empaquetage et déploiement'],
                ['Reverse-proxy',   'Caddy',           '2.7',    'TLS automatique Let\'s Encrypt'],
                ['Orchestration',   'Kubernetes',      '1.29',   'Cluster production (optionnel)'],
                ['CI/CD',           'GitHub Actions',  '—',      'Tests, build, déploiement'],
                ['Métriques',       'Prometheus',      '2.50',   'Collecte des séries chronologiques'],
                ['Visualisation',   'Grafana',         '10',     'Dashboards de métriques'],
                ['Logs',            'Loki',            '3.0',    'Agrégation de logs (optionnel)'],
                ['Trace',           'OpenTelemetry',   '1.x',    'Tracing distribué (optionnel)']
              ]}
            />
          </Section>

          <Section id="p3-network" title="3.9 Architecture réseau">
            <p>
              En déploiement production recommandé, l&apos;architecture réseau respecte le principe de défense en profondeur. Le diagramme ci-dessous synthétise la segmentation typique en trois zones : périmètre public, zone applicative et zone de données.
            </p>
            <DataTable
              caption="Tableau 3.4 — Segmentation réseau recommandée"
              headers={['Zone', 'Composants', 'Accès entrant', 'Accès sortant']}
              rows={[
                ['Périmètre',     'Caddy reverse-proxy, WAF',                    '443/tcp public',         'Vers zone applicative'],
                ['Applicative',   'FastAPI workers, frontend statique',          'Depuis périmètre uniquement', 'Vers zone données + LLM externe'],
                ['Données',       'PostgreSQL, Redis, base cible DW',            'Depuis zone applicative',     'Aucun (sortie bloquée)'],
                ['Administration', 'SSH bastion, journaux centralisés',          '22/tcp via VPN',         'Vers toutes zones (audit)']
              ]}
            />
            <Callout type="success" title="Principe deny-by-default">
              Toutes les NetworkPolicy Kubernetes (ou les security groups AWS, ou les Network Security Groups Azure) sont configurées en mode <em>deny-by-default</em>. Aucun flux n&apos;est autorisé sans une règle explicite. Cette discipline élimine les ouvertures par oubli et facilite considérablement les audits de conformité.
            </Callout>
          </Section>
        </>
      )
    },

    // ========================================================================
    //  P4 — INSTALLATION ET CONFIGURATION
    // ========================================================================
    {
      id: 'p4-install',
      part: 'P4',
      category: 'Mise en route',
      title: 'P4 — Installation et configuration',
      icon: <Server size={17} />,
      toc: [
        { id: 'p4-prereq',     label: '4.1 Pré-requis matériels et logiciels' },
        { id: 'p4-docker',     label: '4.2 Installation Docker Compose' },
        { id: 'p4-baremetal',  label: '4.3 Installation bare-metal Linux' },
        { id: 'p4-windows',    label: '4.4 Installation sous Windows' },
        { id: 'p4-kubernetes', label: '4.5 Déploiement Kubernetes' },
        { id: 'p4-env',        label: '4.6 Référentiel des variables' },
        { id: 'p4-first-run',  label: '4.7 Premier lancement' },
        { id: 'p4-validate',   label: '4.8 Validation post-installation' },
        { id: 'p4-upgrade',    label: '4.9 Procédure de mise à jour' },
        { id: 'p4-trouble',    label: '4.10 Dépannage des incidents courants' }
      ],
      content: (
        <>
          <PartHeader
            part="4"
            title="Installation et Configuration"
            subtitle="Ce chapitre guide pas à pas l'installation d'Agent BI dans cinq scénarios de déploiement : Docker Compose en développement, bare-metal Linux pour production critique, Windows pour les postes développeurs, Kubernetes pour la haute disponibilité, et la procédure de mise à jour. Chaque scénario est documenté avec les commandes exactes à exécuter et les points de validation."
            tags={['Docker', 'Linux', 'Windows', 'Kubernetes', 'Helm', 'Configuration']}
          />

          <Section id="p4-prereq" title="4.1 Pré-requis matériels et logiciels">
            <p>
              Avant toute installation, il convient de vérifier que la machine cible dispose des ressources minimales requises. Les valeurs « recommandées » sont calibrées pour un workload moyen incluant un modèle linguistique distant et un dataset cible de cinquante millions de lignes. Les valeurs « production » correspondent à un déploiement multi-utilisateurs avec une charge soutenue.
            </p>
            <DataTable
              caption="Tableau 4.1 — Ressources matérielles requises"
              headers={['Ressource', 'Minimum', 'Recommandé', 'Production']}
              rows={[
                ['Processeur',         '4 cœurs',           '8 cœurs (avec AVX2)',    '16+ cœurs'],
                ['Mémoire vive',       '8 Go',              '16 Go',                  '32-64 Go'],
                ['Disque',             '20 Go SSD',         '100 Go NVMe',            '500 Go NVMe en RAID 1'],
                ['Système',            'Ubuntu 20.04 LTS',  'Ubuntu 22.04 LTS',       'Ubuntu 24.04 LTS'],
                ['Réseau sortant',     '100 Mbps',          '1 Gbps',                 '10 Gbps avec load balancer'],
                ['Latence vers source', '< 50 ms',           '< 20 ms',                '< 5 ms (réseau privé)'],
                ['GPU (optionnel)',    'Aucun',             'RTX 3060 12 Go',         'A10 ou A100 (LLM local)']
              ]}
            />
            <DataTable
              caption="Tableau 4.2 — Logiciels requis"
              headers={['Logiciel', 'Version minimale', 'Commentaire']}
              rows={[
                ['Docker Engine',                '24.0+',  'Inclut docker compose v2 (sans tiret)'],
                ['Python',                       '3.11.x', 'Uniquement si bare-metal'],
                ['Node.js',                      '18 LTS', 'Uniquement si bare-metal'],
                ['PostgreSQL',                   '15+',    'Pour la base d\'état (auto-fournie en mode Docker)'],
                ['Git',                          '2.40+',  'Pour cloner le dépôt'],
                ['ODBC Driver 18 SQL Server',    '—',      'Si lecture/écriture vers SQL Server'],
                ['unixODBC',                     '2.3.11+','Si bare-metal Linux + SQL Server'],
                ['curl',                         '—',      'Pour les healthchecks et la récupération de paquets']
              ]}
            />
          </Section>

          <Section id="p4-docker" title="4.2 Installation via Docker Compose (recommandée)">
            <p>
              Cette voie est de loin la plus simple et celle retenue par la majorité des installations. Docker Compose orchestre tous les services nécessaires en une seule commande : backend FastAPI, frontend React servi par nginx-unprivileged, base d&apos;état PostgreSQL, Redis, et le reverse-proxy Caddy avec terminaison TLS automatique.
            </p>

            <SubSection id="p4-docker-clone" title="4.2.1 Étape 1 : récupération du dépôt">
              <CodeBlock language="bash" code={`git clone https://github.com/votre-org/agent-data-warehouse.git
cd agent-data-warehouse`} />
            </SubSection>

            <SubSection id="p4-docker-env" title="4.2.2 Étape 2 : préparation du fichier .env">
              <p>
                Le fichier <code>.env.example</code> fournit un modèle complet avec toutes les variables nécessaires et leurs valeurs par défaut. Il est essentiel de personnaliser cinq groupes de variables avant le premier démarrage : authentification JWT, base de données d&apos;état, base cible Data Warehouse, fournisseur de modèle linguistique, et nom de domaine.
              </p>
              <CodeBlock language="bash" code={`cp .env.example .env
# Personnaliser le fichier avec un éditeur de texte
nano .env`} />
              <CodeBlock language="env" filename=".env (extrait)" code={`# ========================================
#  Modèle linguistique
# ========================================
BLAZE_API_KEY=blz_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BLAZE_MODEL=glm-5
LLM_TEMPERATURE=0.1
LLM_TIMEOUT_SECONDS=60

# ========================================
#  Authentification
# ========================================
JWT_SECRET=change-me-generate-a-32-byte-random-string-here
JWT_ALGORITHM=HS256
JWT_EXPIRY_MINUTES=480
ARGON2_TIME_COST=3
ARGON2_MEMORY_COST=65536

# ========================================
#  Base d'état (PostgreSQL)
# ========================================
POSTGRES_USER=adw
POSTGRES_PASSWORD=GenerateStrongPasswordHere!
POSTGRES_DB=agent_dw
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_POOL_SIZE=20
POSTGRES_MAX_OVERFLOW=10

# ========================================
#  Cible Data Warehouse (par défaut)
# ========================================
TARGET_DW_TYPE=mssql
TARGET_DW_HOST=10.0.1.50
TARGET_DW_PORT=1433
TARGET_DW_USER=sa
TARGET_DW_PASSWORD=YourMSSQLPasswordHere!
TARGET_DW_DATABASE=AgentDW_Mart
TARGET_DW_TRUST_SERVER_CERT=true

# ========================================
#  Cache et performance
# ========================================
REDIS_URL=redis://redis:6379/0
LLM_CACHE_TTL_SECONDS=900
LLM_CACHE_MAX_SIZE=1024

# ========================================
#  Reverse-proxy Caddy
# ========================================
CADDY_DOMAIN=agentdw.exemple.com
CADDY_EMAIL=admin@exemple.com

# ========================================
#  Observabilité
# ========================================
PROMETHEUS_ENABLED=true
LOG_FORMAT=json
LOG_LEVEL=INFO
OTEL_EXPORTER_OTLP_ENDPOINT=

# ========================================
#  Politiques de sécurité
# ========================================
HUMAN_REVIEW_REQUIRED=true
MAX_HEAL_ATTEMPTS=3
RATE_LIMIT_DEFAULT=60/minute
SESSION_RETENTION_DAYS=90
AUDIT_RETENTION_YEARS=5`} />
              <Callout type="warning" title="Génération du JWT_SECRET">
                Le secret JWT doit être un nombre aléatoire d&apos;au moins trente-deux octets, encodé en base64. Pour le générer en ligne de commande : <code>python -c &quot;import secrets; print(secrets.token_urlsafe(32))&quot;</code>. Ne jamais réutiliser un secret entre environnements de développement et de production.
              </Callout>
            </SubSection>

            <SubSection id="p4-docker-start" title="4.2.3 Étape 3 : démarrage de la pile">
              <CodeBlock language="bash" code={`# Mode développement (port 5173 frontend, 8000 backend)
docker compose up -d --build

# Mode production (HTTPS via Caddy, ports 80 et 443)
docker compose -f docker-compose.deploy.yml up -d --build

# Suivre les logs
docker compose logs -f backend`} />
            </SubSection>

            <SubSection id="p4-docker-verify" title="4.2.4 Étape 4 : vérification de la santé">
              <CodeBlock language="bash" code={`# État de tous les services
docker compose ps

# Attendu : backend, frontend, postgres, redis, caddy → tous "healthy"

# Test du healthcheck applicatif
curl http://localhost:8000/api/health
# {"status":"ok","db":"ok","llm":"ok","version":"3.0.1"}

# Test depuis l'extérieur (mode production)
curl -I https://agentdw.exemple.com
# HTTP/2 200`} />
            </SubSection>

            <Callout type="success" title="Démarrage en moins de quatre minutes">
              Sur un poste de développement standard (processeur 8 cœurs, 16 Go de RAM, disque NVMe), la séquence complète <code>git clone</code> → <code>docker compose up -d --build</code> → premier login dans le navigateur prend en moyenne trois minutes et quarante secondes. Le téléchargement initial des images Docker représente la majeure partie de cette durée.
            </Callout>
          </Section>

          <DocImage
            src="/docs-screenshots/doc-screenshot-login.png"
            caption="Page de connexion à l'application"
          />

          <Section id="p4-baremetal" title="4.3 Installation bare-metal sous Linux">
            <p>
              Dans certains environnements régulés (santé, défense, finance), Docker est interdit ou son administration centralisée. Agent BI peut alors être installé directement sur le système Linux. Cette voie demande davantage d&apos;intervention manuelle mais offre un contrôle total sur la configuration.
            </p>

            <SubSection id="p4-baremetal-deps" title="4.3.1 Installation des dépendances système">
              <CodeBlock language="bash" code={`# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer les dépendances de base
sudo apt install -y python3.11 python3.11-venv python3.11-dev \\
                    build-essential libpq-dev unixodbc-dev \\
                    nginx git curl gnupg ca-certificates

# Installer Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installer le pilote ODBC 18 pour SQL Server
curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -
curl https://packages.microsoft.com/config/ubuntu/22.04/prod.list \\
     | sudo tee /etc/apt/sources.list.d/mssql-release.list
sudo apt update
sudo ACCEPT_EULA=Y apt install -y msodbcsql18 mssql-tools18`} />
            </SubSection>

            <SubSection id="p4-baremetal-postgres" title="4.3.2 Configuration de PostgreSQL">
              <CodeBlock language="bash" code={`# Installer PostgreSQL 15
sudo apt install -y postgresql-15 postgresql-contrib-15

# Créer l'utilisateur et la base
sudo -u postgres psql <<EOF
CREATE USER adw WITH ENCRYPTED PASSWORD 'StrongPasswordHere!';
CREATE DATABASE agent_dw OWNER adw;
GRANT ALL PRIVILEGES ON DATABASE agent_dw TO adw;
EOF

# Activer l'écoute sur tous les interfaces (à adapter selon votre sécurité)
sudo sed -i "s/^#listen_addresses = 'localhost'/listen_addresses = '*'/" \\
    /etc/postgresql/15/main/postgresql.conf

# Autoriser les connexions
echo "host    agent_dw    adw    127.0.0.1/32    scram-sha-256" \\
    | sudo tee -a /etc/postgresql/15/main/pg_hba.conf

sudo systemctl restart postgresql`} />
            </SubSection>

            <SubSection id="p4-baremetal-backend" title="4.3.3 Déploiement du backend">
              <CodeBlock language="bash" code={`# Cloner le dépôt et préparer l'environnement Python
sudo git clone https://github.com/votre-org/agent-data-warehouse.git /opt/agentdw
sudo chown -R $USER:$USER /opt/agentdw
cd /opt/agentdw

python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt

# Configurer le fichier .env (cf. section précédente)
cp .env.example .env
nano .env

# Migrer la base d'état
alembic upgrade head

# Tester en mode foreground
uvicorn api.server:app --host 0.0.0.0 --port 8000`} />
              <p>
                Une fois le test concluant, configurer le service systemd pour le démarrage automatique :
              </p>
              <CodeBlock language="ini" filename="/etc/systemd/system/agentdw-backend.service" code={`[Unit]
Description=Agent BI Backend
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=notify
User=agentdw
Group=agentdw
WorkingDirectory=/opt/agentdw
Environment="PATH=/opt/agentdw/.venv/bin"
EnvironmentFile=/opt/agentdw/.env
ExecStart=/opt/agentdw/.venv/bin/gunicorn api.server:app \\
    --workers 4 \\
    --worker-class uvicorn.workers.UvicornWorker \\
    --bind 0.0.0.0:8000 \\
    --timeout 120 \\
    --access-logfile /var/log/agentdw/access.log \\
    --error-logfile /var/log/agentdw/error.log
Restart=on-failure
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target`} />
              <CodeBlock language="bash" code={`sudo systemctl daemon-reload
sudo systemctl enable --now agentdw-backend
sudo systemctl status agentdw-backend`} />
            </SubSection>

            <SubSection id="p4-baremetal-frontend" title="4.3.4 Déploiement du frontend">
              <CodeBlock language="bash" code={`cd /opt/agentdw
npm ci
npm run build
# Le bundle de production est généré dans dist/

# Servir via nginx
sudo cp deploy/nginx-agentdw.conf /etc/nginx/sites-available/agentdw
sudo ln -sf /etc/nginx/sites-available/agentdw /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx`} />
            </SubSection>
          </Section>

          <Section id="p4-windows" title="4.4 Installation sous Windows (PowerShell)">
            <p>
              Le dépôt fournit un script <code>start.ps1</code> pour Windows 10 et Windows 11. Il vérifie les dépendances, prépare l&apos;environnement virtuel Python, installe les dépendances frontend, et lance backend et frontend dans deux fenêtres PowerShell distinctes.
            </p>
            <CodeBlock language="powershell" filename="start.ps1 (extrait)" code={`# Vérifier la présence de Python 3.11
if (-not (Get-Command python3.11 -ErrorAction SilentlyContinue)) {
    Write-Error "Python 3.11 introuvable. Téléchargez depuis python.org"
    exit 1
}

# Créer l'environnement virtuel
if (-not (Test-Path .venv)) {
    python3.11 -m venv .venv
}
& .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt | Out-Null

# Installer les dépendances frontend
if (-not (Test-Path node_modules)) {
    npm ci
}

# Lancer le backend dans une nouvelle fenêtre
Start-Process powershell -ArgumentList \`
    '-NoExit', '-Command', \`
    "cd $PWD; & .venv\\Scripts\\Activate.ps1; uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload"

# Lancer le frontend
Start-Process powershell -ArgumentList \`
    '-NoExit', '-Command', \`
    "cd $PWD; npm run dev"

Write-Host "Application démarrée sur http://localhost:5173" -ForegroundColor Green`} />
            <Callout type="warning" title="Antivirus et Windows Defender">
              Windows Defender peut considérablement ralentir Vite HMR et la compilation Python. Il est recommandé d&apos;ajouter les dossiers <code>node_modules\</code> et <code>.venv\</code> aux exclusions de Defender via Paramètres → Sécurité Windows → Protection contre les virus → Exclusions. Ce paramétrage divise par dix le temps de rebuild en mode développement.
            </Callout>
          </Section>

          <Section id="p4-kubernetes" title="4.5 Déploiement Kubernetes (production haute disponibilité)">
            <p>
              Pour les déploiements à fort volume soutenant plus de cinquante utilisateurs concurrents, le projet fournit des charts Helm dans <code>deploy/helm/agentdw/</code>. La configuration recommandée comprend trois replicas backend, deux replicas frontend, un horizontal pod autoscaler basé sur l&apos;utilisation CPU, une anti-affinity entre les replicas, et un PodDisruptionBudget garantissant un minimum de deux backends actifs durant les opérations de maintenance.
            </p>
            <CodeBlock language="yaml" filename="deploy/helm/agentdw/values.yaml" code={`backend:
  replicaCount: 3
  image:
    repository: ghcr.io/votre-org/agentdw-backend
    tag: 3.0.1
  resources:
    requests: { cpu: 500m, memory: 1Gi }
    limits:   { cpu: 2,    memory: 4Gi }
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 12
    targetCPUUtilizationPercentage: 70
  podDisruptionBudget:
    minAvailable: 2
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchLabels: { app: agentdw-backend }
          topologyKey: kubernetes.io/hostname

frontend:
  replicaCount: 2
  image:
    repository: ghcr.io/votre-org/agentdw-frontend
    tag: 3.0.1

postgres:
  enabled: true
  persistence:
    size: 100Gi
    storageClass: fast-ssd
  backup:
    enabled: true
    schedule: "0 2 * * *"

ingress:
  enabled: true
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/proxy-buffering: "off"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: agentdw.exemple.com
      paths: ["/"]
  tls:
    - secretName: agentdw-tls
      hosts: [agentdw.exemple.com]`} />
            <CodeBlock language="bash" code={`# Installer le chart
helm repo add agentdw https://charts.votre-org.com
helm repo update
helm install agentdw agentdw/agentdw \\
    --namespace agentdw --create-namespace \\
    --values custom-values.yaml

# Vérifier le déploiement
kubectl -n agentdw get pods
kubectl -n agentdw rollout status deployment/agentdw-backend`} />
          </Section>

          <Section id="p4-env" title="4.6 Référentiel exhaustif des variables d'environnement">
            <DataTable
              caption="Tableau 4.3 — Variables d'environnement complètes"
              headers={['Variable', 'Défaut', 'Description']}
              rows={[
                ['BLAZE_API_KEY',           '—',       'Clé API du fournisseur linguistique (obligatoire)'],
                ['BLAZE_MODEL',             'glm-5',   'Variante : glm-5, glm-5-mini'],
                ['LLM_TEMPERATURE',         '0.1',     'Température basse pour la régularité du DDL'],
                ['LLM_TIMEOUT_SECONDS',     '60',      'Timeout de chaque appel'],
                ['LLM_CACHE_TTL_SECONDS',   '900',     'Durée du cache (15 minutes)'],
                ['LLM_CACHE_MAX_SIZE',      '1024',    'Taille maximale du cache LRU'],
                ['JWT_SECRET',              '—',       'Secret de signature JWT (≥ 32 octets)'],
                ['JWT_EXPIRY_MINUTES',      '480',     'Durée de vie du token (8 heures)'],
                ['ARGON2_TIME_COST',        '3',       'Coût temps Argon2id (≥ 3 recommandé)'],
                ['POSTGRES_USER/PASSWORD',  '—',       'Identifiants base d\'état'],
                ['POSTGRES_POOL_SIZE',      '20',      'Taille du pool de connexions par worker'],
                ['TARGET_DW_TYPE',          'mssql',   'mssql / postgres / mysql / snowflake'],
                ['REDIS_URL',               '—',       'Optionnel — cache distribué'],
                ['PROMETHEUS_ENABLED',      'true',    'Expose /metrics'],
                ['LOG_FORMAT',              'json',    'json / pretty (texte coloré pour dev)'],
                ['LOG_LEVEL',               'INFO',    'DEBUG / INFO / WARNING / ERROR'],
                ['OTEL_EXPORTER_OTLP_ENDPOINT', '—', 'Endpoint OpenTelemetry (optionnel)'],
                ['HUMAN_REVIEW_REQUIRED',   'true',    'Active la pause de validation humaine'],
                ['MAX_HEAL_ATTEMPTS',       '3',       'Tentatives avant échec définitif'],
                ['SESSION_RETENTION_DAYS',  '90',      'Durée de conservation des sessions'],
                ['AUDIT_RETENTION_YEARS',   '5',       'Durée de conservation des logs d\'audit'],
                ['CADDY_DOMAIN',            '—',       'Nom de domaine HTTPS automatique'],
                ['CADDY_EMAIL',             '—',       'Email Let\'s Encrypt']
              ]}
            />
          </Section>

          <Section id="p4-first-run" title="4.7 Premier lancement et création du compte administrateur">
            <p>
              Au premier démarrage, la base d&apos;état est vide. Aucun compte n&apos;existe. Deux méthodes permettent de créer le compte super-administrateur initial.
            </p>
            <CodeBlock language="bash" code={`# Méthode 1 : via la CLI dans le conteneur
docker compose exec backend python main.py users create-admin \\
    --email admin@exemple.com \\
    --password "ChangeMeNow123!" \\
    --full-name "Administrateur"

# Méthode 2 : via l'interface web /register
# Le premier compte créé est automatiquement promu au rôle admin`} />
            <p>
              Une fois le compte créé, ouvrir un navigateur sur <code>https://agentdw.exemple.com</code> en mode production ou <code>http://localhost:5173</code> en mode développement. La page de connexion permet d&apos;entrer les identifiants. Au premier login, l&apos;utilisateur est invité à activer l&apos;authentification à deux facteurs (TOTP) et à compléter son profil.
            </p>
          </Section>

          <Section id="p4-validate" title="4.8 Validation post-installation">
            <p>
              Trois suites de tests permettent de valider exhaustivement l&apos;installation. Les exécuter dans cet ordre garantit que chaque couche fonctionne correctement avant de tester la suivante.
            </p>
            <CodeBlock language="bash" code={`# 1) Tests unitaires et d'intégration backend (116 tests)
docker compose exec backend pytest -q
# Sortie attendue : 116 passed in 47.32s

# 2) Tests d'interface end-to-end Playwright (24 scénarios)
docker compose exec frontend npm run test:e2e
# Sortie attendue : 24 passed (Chromium, Firefox, WebKit)

# 3) Test du pipeline complet sur le dataset de démonstration
docker compose exec backend python main.py demo run-full
# Sortie attendue :
#   Pipeline completed in 3m12s
#   Rows loaded: 142,388
#   DQ score: 87.3 / 100
#   Export generated: outputs/demo_warehouse.bak (38.4 MB)`} />
          </Section>

          <Section id="p4-upgrade" title="4.9 Procédure de mise à jour">
            <p>
              Les mises à jour mineures (3.0.x → 3.0.y) ne nécessitent aucune intervention manuelle au-delà du redéploiement des images Docker. Les mises à jour majeures (3.0.x → 3.1.0) peuvent introduire des migrations de schéma de base d&apos;état. La procédure recommandée comporte cinq étapes.
            </p>
            <CodeBlock language="bash" code={`# 1) Sauvegarder la base d'état
docker compose exec postgres pg_dump -U adw agent_dw \\
    | gzip > backup-pre-upgrade-$(date +%Y%m%d).sql.gz

# 2) Récupérer la nouvelle version
git fetch --tags
git checkout v3.1.0

# 3) Reconstruire les images
docker compose build

# 4) Appliquer les migrations
docker compose run --rm backend alembic upgrade head

# 5) Redéployer la pile complète
docker compose up -d

# 6) Vérifier la santé
curl http://localhost:8000/api/health`} />
          </Section>

          <Section id="p4-trouble" title="4.10 Dépannage des incidents courants">
            <DataTable
              caption="Tableau 4.4 — Symptômes, causes et résolutions"
              headers={['Symptôme', 'Cause probable', 'Résolution']}
              rows={[
                ['Backend retourne 502',           'PostgreSQL pas encore healthy',     'Patienter 30 s, vérifier docker compose ps'],
                ['LLM timeout systématique',      'Quota API atteint ou réseau bloqué', 'Vérifier BLAZE_API_KEY et augmenter LLM_TIMEOUT_SECONDS'],
                ['ODBC error 18456',              'Identifiants SQL Server incorrects', 'Tester via sqlcmd, vérifier TrustServerCertificate=yes'],
                ['Frontend page blanche',         'Build Vite échoué',                   'docker compose logs frontend, npm ci dans le conteneur'],
                ['SSE déconnexion permanente',    'Reverse-proxy bufferisant',           'Vérifier proxy_buffering off dans nginx'],
                ['Pipeline bloqué sur Explorer',  'Permissions DB insuffisantes',        'L\'utilisateur doit avoir SELECT sur INFORMATION_SCHEMA'],
                ['Cache LLM hit ratio < 30%',     'TTL trop court ou cache trop petit', 'Augmenter LLM_CACHE_TTL_SECONDS à 3600'],
                ['Migrations alembic échouent',   'Schéma source modifié manuellement',  'Restaurer le backup, relancer la migration'],
                ['Healthcheck rapporte db: error', 'Pool PostgreSQL saturé',              'Augmenter POSTGRES_POOL_SIZE et redémarrer'],
                ['CSP bloque le frontend',        'Domaine custom non autorisé',         'Mettre à jour la CSP dans security_headers.py']
              ]}
            />
          </Section>
        </>
      )
    },

    // ========================================================================
    //  P5 — CATALOGUE DES MODULES SPÉCIALISÉS
    // ========================================================================
    {
      id: 'p5-modules',
      part: 'P5',
      category: 'Architecture interne',
      title: 'P5 — Catalogue des modules',
      icon: <Boxes size={17} />,
      toc: [
        { id: 'p5-overview',  label: '5.1 Vue d\'ensemble' },
        { id: 'p5-discovery', label: '5.2 Famille Découverte' },
        { id: 'p5-modeling',  label: '5.3 Famille Modélisation' },
        { id: 'p5-etl',       label: '5.4 Famille ETL' },
        { id: 'p5-quality',   label: '5.5 Famille Qualité et sécurité' },
        { id: 'p5-catalog',   label: '5.6 Famille Catalogue et lineage' },
        { id: 'p5-insights',  label: '5.7 Famille Insights et prévisions' },
        { id: 'p5-ops',       label: '5.8 Famille Opérations' },
        { id: 'p5-summary',   label: '5.9 Synthèse et interactions' }
      ],
      content: (
        <>
          <PartHeader
            part="5"
            title="Catalogue Détaillé des Modules Spécialisés"
            subtitle="Ce chapitre constitue la référence exhaustive de tous les modules qui composent Agent BI. Pour chaque module, sont documentés sa mission, son cahier des charges synthétique, ses entrées et sorties, ainsi que ses interactions avec les autres modules. Les modules sont regroupés en sept familles fonctionnelles cohérentes."
            tags={['Modules', 'Référence', 'Architecture', 'Workflow']}
          />

          <Section id="p5-overview" title="5.1 Vue d'ensemble : l'orchestre des vingt-trois modules">
            <p>
              Agent BI se compose de vingt-trois modules Python autonomes, chacun spécialisé dans une tâche précise. Tous communiquent uniquement via l&apos;objet d&apos;état présenté au chapitre 2. Le tableau suivant liste les vingt-trois modules groupés par famille fonctionnelle. Chaque ligne renvoie à la sous-section qui le détaille.
            </p>
            <DataTable
              caption="Tableau 5.1 — Carte des vingt-trois modules"
              headers={['Famille', 'Nombre', 'Modules']}
              rows={[
                ['Découverte',           '3', 'Explorer · Profiler · SchemaDriftDetector'],
                ['Modélisation',         '4', 'Modeler · Critic · DataVaultModeler · ChatModifier'],
                ['ETL',                  '5', 'EtlInitializer · EtlExtractor · EtlTransformer · EtlLoader · EtlExecutor'],
                ['Qualité et sécurité',  '4', 'DataQuality · GovernanceAgent · PiiClassifier · Healer'],
                ['Catalogue et lineage', '3', 'Cataloger · LineageTracker · QueryGenerator'],
                ['Insights et prévisions', '2', 'InsightGenerator · Forecaster'],
                ['Opérations',           '2', 'CdcWatermark · MockGenerator']
              ]}
            />
          </Section>

          <Section id="p5-discovery" title="5.2 Famille Découverte">
            <ModuleCard
              icon={<Compass size={22} className="text-indigo-600" />}
              name="Explorer"
              role="Scanne information_schema de la base source, échantillonne cent lignes par table, devine les clés primaires et étrangères même en l'absence de contraintes déclarées, et classifie la nature présumée de chaque table : fait, dimension, table de jonction, table de référence, ou table d'audit."
              inputs="connection_config, raw_schema_dump, sample_data"
              outputs="explorer_profile (JSON structuré)"
              color="indigo"
            />
            <ModuleCard
              icon={<Eye size={22} className="text-cyan-600" />}
              name="Profiler"
              role="Calcule les statistiques descriptives par colonne : nombre de valeurs, distinct_count, null_count, min, max, percentiles, top-K. Détecte les colonnes candidates à devenir clés primaires (cardinalité égale au nombre de lignes) et celles candidates à devenir mesures (numériques avec faible cardinalité de FK)."
              inputs="explorer_profile, sample_data"
              outputs="column_statistics (Dict[col_full_name, ColumnStats])"
              color="cyan"
            />
            <ModuleCard
              icon={<Activity size={22} className="text-amber-600" />}
              name="SchemaDriftDetector"
              role="Compare le schéma actuel avec le checkpoint précédent (signature SHA-256 par colonne). Émet un événement DRIFT_ALERT et déclenche le Modeler en mode patch si une colonne est ajoutée, supprimée ou changée de type."
              inputs="current_schema_signature, previous_schema_signature"
              outputs="drift_diff (liste d'opérations ALTER TABLE recommandées)"
              color="amber"
            />
          </Section>

          <Section id="p5-modeling" title="5.3 Famille Modélisation">
            <ModuleCard
              icon={<Layers size={22} className="text-purple-600" />}
              name="Modeler"
              role="Cœur de la plateforme. Applique les règles Kimball pour produire un schéma en étoile complet. Détecte la fact table par scoring multi-critères. Aplatit les dimensions snowflake. Génère les SCD Type 2 avec valid_from / valid_to / is_current / row_hash. Émet le DDL T-SQL complet adapté au dialecte cible."
              inputs="explorer_profile, column_statistics, modeling_strategy"
              outputs="star_schema (JSON), sql_ddl (str)"
              color="purple"
            />
            <ModuleCard
              icon={<ShieldCheck size={22} className="text-rose-600" />}
              name="Critic"
              role="Audite le modèle produit selon une checklist Kimball stricte : toutes les FK ont une dimension correspondante, les surrogate keys sont uniques, chaque dimension a au moins une date de chargement, la fact table comporte au moins deux mesures, les noms suivent la convention dim_/fact_. Score de zéro à cent. En dessous de soixante-quinze, déclenche une boucle de correction."
              inputs="star_schema, sql_ddl"
              outputs="critic_review (liste de findings), critic_score (float)"
              color="rose"
            />
            <ModuleCard
              icon={<GitMerge size={22} className="text-emerald-600" />}
              name="DataVaultModeler"
              role="Variante optionnelle du Modeler. Génère une architecture Data Vault 2.0 (Hubs / Links / Satellites) au lieu du schéma en étoile. Utile pour les fusions d'entreprises avec plus de dix ERP hétérogènes."
              inputs="explorer_profile, modeling_strategy='data_vault'"
              outputs="data_vault_model (JSON), sql_ddl_dv (str)"
              color="emerald"
            />
            <ModuleCard
              icon={<MessageSquare size={22} className="text-cyan-600" />}
              name="ChatModifier"
              role="Reçoit une demande utilisateur en langage naturel, la traduit en une liste d'opérations atomiques (add_column, split_date_key, change_column_type, add_fk, drop_table), puis applique le patch au modèle et au DDL de manière idempotente."
              inputs="user_message, current_star_schema"
              outputs="patch_operations[], updated_star_schema, updated_sql_ddl"
              color="cyan"
            />
          </Section>

          <Section id="p5-etl" title="5.4 Famille ETL">
            <ModuleCard icon={<Play size={22} className="text-indigo-600" />} name="EtlInitializer"
              role="Crée la base cible si elle n'existe pas, exécute le DDL, prépare les tables d'audit (etl_runs, etl_watermark, etl_quarantine), insère la dim_date avec le calendrier complet de 1900 à 2100."
              inputs="sql_ddl, target_dw_config" outputs="initial_db_state" color="indigo"/>
            <ModuleCard icon={<Database size={22} className="text-cyan-600" />} name="EtlExtractor"
              role="Génère le code d'extraction approprié au type de source : T-SQL OPENROWSET, Python pyodbc, ou source dbt. Applique le watermark CDC pour ne lire que les delta. Met en quarantaine les lignes mal-formées."
              inputs="star_schema, last_watermark" outputs="extraction_code, rows_extracted_count" color="cyan"/>
            <ModuleCard icon={<Filter size={22} className="text-purple-600" />} name="EtlTransformer"
              role="Génère les transformations : mapping colonnes source vers target, attribution de surrogate keys, nettoyage (trim, upper, normalisation Unicode), enrichissement (Soundex, géocodage si activé), application des règles SCD2."
              inputs="extraction_code, star_schema" outputs="transformation_sql" color="purple"/>
            <ModuleCard icon={<Send size={22} className="text-emerald-600" />} name="EtlLoader"
              role="Génère le code de chargement bulk-insert adapté à la cible : T-SQL INSERT … SELECT, COPY pour PostgreSQL, COPY INTO pour Snowflake. Utilise des transactions par batch de cinquante mille lignes."
              inputs="transformation_sql, star_schema" outputs="loading_sql" color="emerald"/>
            <ModuleCard icon={<Workflow size={22} className="text-amber-600" />} name="EtlExecutor"
              role="Exécute réellement le pipeline ETL contre la base cible. Diffuse les logs ligne par ligne via SSE. En cas d'erreur, achemine l'événement vers le Healer. Met à jour etl_watermark à la fin du chargement."
              inputs="extraction_code + transformation_sql + loading_sql" outputs="etl_status, etl_logs[], rows_loaded" color="amber"/>
          </Section>

          <Section id="p5-quality" title="5.5 Famille Qualité et sécurité">
            <ModuleCard icon={<CheckCircle2 size={22} className="text-emerald-600" />} name="DataQuality"
              role="Évalue douze dimensions de qualité : complétude, validité, unicité, cohérence référentielle, fraîcheur, conformité format, plausibilité statistique (z-score), précision, traçabilité, intégrité, disponibilité, accessibilité. Score global de zéro à cent. En dessous de cinquante, bloque le pipeline."
              inputs="sample_data, column_statistics, business_rules" outputs="dq_score, dq_issues[]" color="emerald"/>
            <ModuleCard icon={<Lock size={22} className="text-rose-600" />} name="GovernanceAgent"
              role="Applique les politiques d'accès : classification des données (public, interne, confidentiel, restreint), masquage des colonnes PII dans les exports, ajout des annotations RGPD et HIPAA dans le catalogue."
              inputs="catalog, governance_policies" outputs="masked_catalog, governance_annotations" color="rose"/>
            <ModuleCard icon={<Hash size={22} className="text-amber-600" />} name="PiiClassifier"
              role="Détecte les colonnes contenant des données personnelles via regex (NIN, SSN, IBAN, email, téléphone, plaque d'immatriculation) et confirmation linguistique pour les cas ambigus. Étiquette les colonnes pour masquage automatique en export."
              inputs="column_statistics, sample_data" outputs="pii_tags{column → category}" color="amber"/>
            <ModuleCard icon={<Wrench size={22} className="text-indigo-600" />} name="Healer"
              role="Quand EtlExecutor échoue, reçoit la trace d'erreur, le DDL et le dialecte cible. Diagnostique : 'Unknown column' devient correction du mapping, 'String too long' devient ALTER VARCHAR, 'PK violation' devient ajout de MERGE. Maximum trois tentatives consécutives."
              inputs="etl_error_traceback, current_ddl, etl_code" outputs="patched_ddl, patched_etl_code, heal_explanation" color="indigo"/>
          </Section>

          <Section id="p5-catalog" title="5.6 Famille Catalogue et lineage">
            <ModuleCard icon={<Boxes size={22} className="text-purple-600" />} name="Cataloger"
              role="Construit le catalogue : description générée pour chaque table et colonne, glossaire métier (rapprochement avec un dictionnaire industrie standard), tags hiérarchiques pour la recherche."
              inputs="star_schema, business_glossary" outputs="catalog{tables, columns, tags, descriptions}" color="purple"/>
            <ModuleCard icon={<GitBranch size={22} className="text-cyan-600" />} name="LineageTracker"
              role="Reconstruit le graphe de lineage colonne à colonne en parsant le SQL ETL généré (via sqlglot). Permet de répondre à 'd'où vient la colonne fact_sales.revenue ?' en restituant la chaîne complète Source → Staging → Target."
              inputs="extraction_code, transformation_sql, loading_sql" outputs="lineage_graph{column → [parents]}" color="cyan"/>
            <ModuleCard icon={<Search size={22} className="text-emerald-600" />} name="QueryGenerator"
              role="Outil utilisateur : reçoit une question formulée en langage naturel, génère le SQL adéquat sur le DW, détecte les noms de colonnes par fuzzy matching sur le catalogue, et retourne le résultat avec explication."
              inputs="user_question, catalog, lineage_graph" outputs="generated_sql, explanation" color="emerald"/>
          </Section>

          <Section id="p5-insights" title="5.7 Famille Insights et prévisions">
            <ModuleCard icon={<BarChart3 size={22} className="text-amber-600" />} name="InsightGenerator"
              role="Analyse les top mesures du DW, détecte les tendances notables (variation MoM supérieure à vingt pour cent, anomalies par z-score), génère les KPIs de l'Executive Summary, propose cinq insights formulés en langage naturel."
              inputs="fact_tables, dimensions, time_window" outputs="executive_kpis[], insights[]" color="amber"/>
            <ModuleCard icon={<Trophy size={22} className="text-rose-600" />} name="Forecaster"
              role="Pour chaque mesure détectée, lance un Prophet ou un ARIMA léger pour fournir une prédiction à 30, 60 et 90 jours. La sortie est utilisée par le composant ExecutiveSummary."
              inputs="time_series, horizon_days" outputs="forecast{ds, yhat, yhat_lower, yhat_upper}" color="rose"/>
          </Section>

          <Section id="p5-ops" title="5.8 Famille Opérations">
            <ModuleCard icon={<Clock size={22} className="text-cyan-600" />} name="CdcWatermark"
              role="Maintient une table etl_watermark indiquant la valeur max(updated_at) ou max(LSN) par table source. Garantit l'idempotence des chargements incrémentaux."
              inputs="last_etl_run_summary" outputs="updated_watermarks{table → value}" color="cyan"/>
            <ModuleCard icon={<Sparkles size={22} className="text-purple-600" />} name="MockGenerator"
              role="Mode démonstration ou formation. Produit cinquante mille lignes synthétiques cohérentes (Faker plus corrélations métier) pour tester la plateforme sans connexion à une base réelle."
              inputs="star_schema, n_rows" outputs="mock_csvs{table.csv}" color="purple"/>
          </Section>

          <Section id="p5-summary" title="5.9 Synthèse et interactions">
            <p>
              Le diagramme ci-après synthétise les interactions principales entre les vingt-trois modules. Les flèches pleines indiquent les transitions séquentielles, les flèches pointillées les boucles conditionnelles (correction, réparation, modification humaine).
            </p>
            <DocImage
              src="/docs-screenshots/doc-screenshot-modules.png"
              caption="Diagramme d'interactions des 23 modules"
            />
          </Section>
        </>
      )
    },

    // ========================================================================
    //  P6 — MODÉLISATION DIMENSIONNELLE KIMBALL
    // ========================================================================
    {
      id: 'p6-modeling',
      part: 'P6',
      category: 'Architecture interne',
      title: 'P6 — Modélisation dimensionnelle',
      icon: <Database size={17} />,
      toc: [
        { id: 'p6-fact-detection', label: '6.1 Détection de la fact table' },
        { id: 'p6-snowflake',      label: '6.2 Aplatissement Snowflake' },
        { id: 'p6-scd2',           label: '6.3 SCD Type 2 automatique' },
        { id: 'p6-junk',           label: '6.4 Junk dimensions' },
        { id: 'p6-bridge',         label: '6.5 Bridge tables M:N' },
        { id: 'p6-role',           label: '6.6 Role-playing dimensions' },
        { id: 'p6-degenerate',     label: '6.7 Dimensions dégénérées' },
        { id: 'p6-mini',           label: '6.8 Mini-dimensions' },
        { id: 'p6-quarantine',     label: '6.9 Tables de quarantaine' },
        { id: 'p6-prompts',        label: '6.10 Architecture des prompts' }
      ],
      content: (
        <>
          <PartHeader
            part="6"
            title="Modélisation Dimensionnelle Kimball"
            subtitle="Ce chapitre détaille les mécanismes par lesquels le module Modeler applique de manière déterministe les patterns Kimball : détection de la fact table, aplatissement snowflake vers étoile, génération SCD Type 2, junk dimensions, bridge tables, role-playing, dimensions dégénérées et mini-dimensions. Chaque pattern est illustré par un exemple SQL complet."
            tags={['Kimball', 'Star Schema', 'SCD2', 'Patterns', 'DDL']}
          />

          <Section id="p6-fact-detection" title="6.1 Algorithme de détection de la fact table">
            <p>
              Sur une base source de trente tables, identifier laquelle est la table de faits centrale n&apos;est pas trivial. Le Modeler combine cinq signaux pondérés et choisit la table au score le plus élevé. Cet algorithme a été calibré empiriquement sur trois cents schémas représentatifs avant d&apos;être figé en version 3.0.
            </p>
            <DataTable
              caption="Tableau 6.1 — Heuristique de scoring fact table"
              headers={['Signal', 'Poids', 'Justification']}
              rows={[
                ['Nombre de FK',                     '0.30', 'Plus une table référence d\'autres tables, plus elle est probablement une fact'],
                ['Ratio colonnes numériques',        '0.25', 'Une fact table contient typiquement plus de quarante pour cent de colonnes numériques non-FK'],
                ['Nombre de lignes (log normalisé)', '0.20', 'Une fact est généralement la plus grosse table de la base'],
                ['Pattern de nommage',               '0.15', 'Mots-clés typiques : transaction, sale, order, event, log, movement'],
                ['Présence d\'une colonne date',    '0.10', 'Une date d\'événement est la signature presque universelle d\'une fact']
              ]}
            />
            <CodeBlock language="python" filename="nodes/modeler.py" code={`def score_fact_candidate(table_meta: dict) -> float:
    score = 0.0
    n_cols = len(table_meta["columns"])

    # 1) Nombre de FK
    fk_count = sum(1 for c in table_meta["columns"] if c.get("guessed_fk"))
    score += 0.30 * min(fk_count / 5, 1.0)

    # 2) Ratio numérique non-clé
    numeric_non_key = [
        c for c in table_meta["columns"]
        if c["type"] in ("DECIMAL", "NUMERIC", "INT", "BIGINT", "FLOAT", "REAL")
        and not c.get("guessed_fk") and not c.get("guessed_pk")
    ]
    score += 0.25 * (len(numeric_non_key) / max(n_cols, 1))

    # 3) Nombre de lignes (échelle logarithmique, plafonné à 1M)
    rows = table_meta.get("nb_lignes_estime", 0)
    score += 0.20 * min(math.log10(rows + 1) / 6, 1.0)

    # 4) Pattern de nommage
    fact_keywords = {
        "transaction", "sale", "order", "event", "log", "fact",
        "movement", "operation", "trade", "click", "session"
    }
    name = table_meta["nom_table"].lower()
    if any(kw in name for kw in fact_keywords):
        score += 0.15

    # 5) Présence d'une colonne date
    has_date = any(c["type"] in ("DATE", "DATETIME", "TIMESTAMP", "DATETIME2")
                   for c in table_meta["columns"])
    if has_date:
        score += 0.10

    return score

def detect_fact_table(profile: list[dict]) -> dict:
    scored = [(score_fact_candidate(t), t) for t in profile]
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]   # table avec le meilleur score`} />
            <Callout type="note" title="Pattern Header / Détail">
              Lorsque la base source contient deux tables fortement liées (par exemple <code>orders</code> et <code>order_details</code>), le Modeler les fusionne dans une unique <code>fact_sales</code> à la granularité ligne-de-commande, en propageant les attributs entête (date, customer_id, payment_method) sur chaque ligne de détail. Cette fusion est documentée dans la sortie du module et tracée dans le lineage.
            </Callout>
          </Section>

          <Section id="p6-snowflake" title="6.2 Aplatissement Snowflake vers étoile">
            <p>
              Lorsque la source contient une chaîne de normalisation de type <code>customer → city → region → country</code>, il s&apos;agit d&apos;un schéma flocon. Le Modeler aplatit cette hiérarchie en une seule <code>dim_customer</code> dénormalisée contenant <code>city, region, country</code> comme attributs directs. Cette opération accélère les requêtes de Business Intelligence d&apos;un facteur trois à dix selon la profondeur de la hiérarchie aplatie.
            </p>
            <CodeBlock language="sql" code={`-- AVANT (snowflake) — quatre tables, trois jointures pour atteindre le pays
SELECT cu.full_name, co.name AS country
FROM customer cu
JOIN city    ci ON ci.id = cu.city_id
JOIN region  r  ON r.id  = ci.region_id
JOIN country co ON co.id = r.country_id;

-- APRÈS (star) — une seule jointure, depuis la fact table
SELECT dc.full_name, dc.country
FROM fact_sales f
JOIN dim_customer dc ON dc.sk_customer = f.sk_customer;`} />
            <p>
              Un cas de figure justifie de conserver une dimension en flocon plutôt que de l&apos;aplatir : lorsque la hiérarchie est très volumineuse (plus de cent millions de lignes au niveau le plus fin) et que l&apos;outil de BI sait gérer nativement les jointures multiples. Dans ce cas, le Modeler peut être contraint via <code>preserve_snowflake=&quot;dim_customer&quot;</code> à laisser la structure intacte.
            </p>
          </Section>

          <Section id="p6-scd2" title="6.3 Slowly Changing Dimensions Type 2">
            <p>
              Dès qu&apos;une dimension est susceptible de changer dans le temps (un client déménage, change de segment marketing, modifie son adresse de facturation), le Modeler injecte automatiquement le pattern SCD2. Quatre colonnes techniques sont ajoutées à chaque table de dimension concernée.
            </p>
            <DataTable
              caption="Tableau 6.2 — Colonnes techniques SCD Type 2"
              headers={['Colonne', 'Type', 'Rôle']}
              rows={[
                ['valid_from', 'DATETIME2', 'Date de début de validité de la version'],
                ['valid_to',   'DATETIME2', 'Date de fin de validité (NULL si version courante)'],
                ['is_current', 'BIT',       '1 si version courante, 0 sinon'],
                ['row_hash',   'CHAR(64)',  'SHA-256 des attributs fonctionnels — détecte les changements']
              ]}
            />
            <p>
              Le code de fusion généré par le module EtlTransformer est un <code>MERGE</code> T-SQL standard, idempotent et réentrant. Toute exécution répétée produit le même état final, ce qui garantit la sûreté en cas de reprise après incident.
            </p>
            <CodeBlock language="sql" filename="MERGE SCD Type 2 généré" code={`-- Exemple : insertion + expiration via MERGE T-SQL
MERGE dim_customer AS tgt
USING (
    SELECT *,
           CONVERT(CHAR(64), HASHBYTES('SHA2_256',
               CONCAT_WS('|', full_name, email, city, segment)), 2) AS row_hash
    FROM staging_customer
) AS src
   ON tgt.bk_customer_id = src.bk_customer_id
  AND tgt.is_current = 1

WHEN MATCHED AND tgt.row_hash <> src.row_hash THEN
    UPDATE SET tgt.valid_to   = SYSUTCDATETIME(),
               tgt.is_current = 0

WHEN NOT MATCHED BY TARGET THEN
    INSERT (bk_customer_id, full_name, email, city, segment,
            valid_from, valid_to, is_current, row_hash)
    VALUES (src.bk_customer_id, src.full_name, src.email, src.city, src.segment,
            SYSUTCDATETIME(), NULL, 1, src.row_hash);

-- Réinsertion des nouvelles versions pour les MATCHED expirés
INSERT INTO dim_customer (bk_customer_id, full_name, email, city, segment,
                          valid_from, valid_to, is_current, row_hash)
SELECT src.bk_customer_id, src.full_name, src.email, src.city, src.segment,
       SYSUTCDATETIME(), NULL, 1, src.row_hash
FROM staging_customer src
JOIN dim_customer tgt
  ON tgt.bk_customer_id = src.bk_customer_id
 AND tgt.is_current = 0
 AND tgt.valid_to = (SELECT MAX(valid_to)
                     FROM dim_customer
                     WHERE bk_customer_id = src.bk_customer_id);`} />
            <Callout type="tip" title="Quand SCD Type 2 n'est pas approprié">
              Pour les dimensions à très haute volatilité ou à très faible valeur historique (par exemple <code>dim_session_browser</code>), il est préférable de conserver uniquement la version courante (SCD Type 1). Le Modeler peut être instruit via le paramètre <code>scd_strategy_per_dim={`{"dim_session_browser": "type_1"}`}</code> qui désactive le SCD2 sélectivement.
            </Callout>
          </Section>

          <Section id="p6-junk" title="6.4 Junk dimensions">
            <p>
              Une junk dimension regroupe en une seule table les flags et indicateurs de bas cardinal (is_promotional, payment_method, channel, is_internal_test) plutôt que de les laisser comme colonnes désordonnées dans la fact table. Le Modeler crée automatiquement <code>dim_junk_sales_flags</code> au cartésien des combinaisons effectivement observées, ce qui réduit drastiquement la taille de la fact tout en améliorant la lisibilité.
            </p>
            <CodeBlock language="sql" code={`CREATE TABLE dim_junk_sales_flags (
    sk_junk           INT IDENTITY PRIMARY KEY,
    is_promotional    BIT,
    payment_method    VARCHAR(20),  -- card, cash, voucher, transfer
    channel           VARCHAR(20),  -- store, web, mobile, phone
    is_internal_test  BIT,
    UNIQUE (is_promotional, payment_method, channel, is_internal_test)
);

-- La fact table référence cette dimension par une seule FK
ALTER TABLE fact_sales
    ADD sk_junk INT NOT NULL REFERENCES dim_junk_sales_flags(sk_junk);`} />
          </Section>

          <Section id="p6-bridge" title="6.5 Bridge tables — relations many-to-many">
            <p>
              Quand un client peut détenir plusieurs comptes et qu&apos;un compte peut être détenu par plusieurs clients (compte joint), le Modeler crée une <code>bridge_customer_account</code> avec les colonnes <code>sk_customer, sk_account, weight_factor</code>. Le facteur de pondération permet d&apos;attribuer correctement les mesures aux différents clients (cinquante pour cent à chacun pour un compte joint à deux titulaires).
            </p>
            <CodeBlock language="sql" code={`CREATE TABLE bridge_customer_account (
    sk_customer    INT NOT NULL REFERENCES dim_customer(sk_customer),
    sk_account     INT NOT NULL REFERENCES dim_account(sk_account),
    weight_factor  DECIMAL(5, 4) NOT NULL DEFAULT 1.0000,
    valid_from     DATETIME2 NOT NULL,
    valid_to       DATETIME2,
    is_current     BIT NOT NULL,
    PRIMARY KEY (sk_customer, sk_account, valid_from)
);`} />
          </Section>

          <Section id="p6-role" title="6.6 Role-playing dimensions">
            <p>
              La même dimension <code>dim_date</code> est fréquemment référencée plusieurs fois par une même fact table sous différents alias : <code>order_date_key</code>, <code>ship_date_key</code>, <code>delivery_date_key</code>, <code>payment_date_key</code>. Le Modeler génère plusieurs vues SQL aliasing la même table physique, ce qui évite la duplication de données tout en préservant la lisibilité des requêtes.
            </p>
            <CodeBlock language="sql" code={`CREATE VIEW dim_date_order    AS SELECT * FROM dim_date;
CREATE VIEW dim_date_ship     AS SELECT * FROM dim_date;
CREATE VIEW dim_date_delivery AS SELECT * FROM dim_date;
CREATE VIEW dim_date_payment  AS SELECT * FROM dim_date;

-- Requête typique avec quatre rôles distincts
SELECT
    do.full_date  AS order_date,
    ds.full_date  AS ship_date,
    dd.full_date  AS delivery_date,
    dp.full_date  AS payment_date,
    f.revenue
FROM fact_sales f
JOIN dim_date_order    do ON do.sk_date = f.sk_order_date
JOIN dim_date_ship     ds ON ds.sk_date = f.sk_ship_date
JOIN dim_date_delivery dd ON dd.sk_date = f.sk_delivery_date
JOIN dim_date_payment  dp ON dp.sk_date = f.sk_payment_date;`} />
          </Section>

          <Section id="p6-degenerate" title="6.7 Dimensions dégénérées">
            <p>
              Une dimension dégénérée est un attribut qui se comporte comme une dimension (utilisable comme axe d&apos;analyse) mais qui n&apos;a pas d&apos;attributs propres méritant une table séparée. Le numéro de bordereau, le numéro de transaction, le numéro de ticket de caisse en sont les exemples typiques. Ils restent des colonnes de la table de faits, sans donner naissance à une dimension dédiée.
            </p>
          </Section>

          <Section id="p6-mini" title="6.8 Mini-dimensions">
            <p>
              Lorsqu&apos;une dimension comporte des attributs très volatiles (qui changent fréquemment) mêlés à des attributs stables, le SCD Type 2 produit une explosion combinatoire. La parade consiste à extraire les attributs volatiles dans une mini-dimension. Par exemple, le segment marketing d&apos;un client (qui peut changer plusieurs fois par mois en fonction de ses achats) est extrait dans une <code>dim_customer_demographics</code> séparée, tandis que <code>dim_customer</code> ne conserve que les attributs stables (nom, email).
            </p>
          </Section>

          <Section id="p6-quarantine" title="6.9 Tables de quarantaine">
            <p>
              Toute ligne source rejetée par les règles de validation (FK non résolvable, type incompatible, NIN invalide, valeur hors plage) est insérée dans <code>quarantine_&lt;source_table&gt;</code> avec une colonne <code>rejection_reason</code> explicative et un horodatage. L&apos;utilisateur peut consulter ces lignes via le composant <code>DataQualityPanel</code>, les corriger, puis les réintégrer manuellement.
            </p>
            <CodeBlock language="sql" code={`CREATE TABLE quarantine_orders (
    quarantine_id     BIGINT IDENTITY PRIMARY KEY,
    original_row      NVARCHAR(MAX),  -- JSON de la ligne source
    rejection_reason  VARCHAR(500),   -- ex : "FK customer_id non résolvable"
    rejected_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    etl_run_id        BIGINT NOT NULL REFERENCES etl_runs(run_id),
    resolved          BIT NOT NULL DEFAULT 0,
    resolved_at       DATETIME2,
    resolved_by       VARCHAR(120)
);

CREATE INDEX ix_quarantine_orders_unresolved
    ON quarantine_orders(rejected_at) WHERE resolved = 0;`} />
          </Section>

          <Section id="p6-prompts" title="6.10 Architecture des prompts du Modeler">
            <p>
              Les prompts système du Modeler sont versionnés Git dans <code>nodes/prompts/modeler.md</code>. Ils suivent une structure stricte en cinq blocs : rôle, règles dures, règles souples, format de sortie attendu, exemples few-shot. Cette discipline garantit que les évolutions du prompt sont traçables et auditables.
            </p>
            <CodeBlock language="markdown" filename="nodes/prompts/modeler.md (extrait)" code={`# Module Modeler — Cahier des charges v3.2

Tu produis un schéma en étoile Kimball.

## Règles dures (à ne jamais violer)
1. Toute table de dimension doit avoir une surrogate key technique de type INT IDENTITY.
2. Toute fact table doit référencer au moins une dim_date.
3. Aucune colonne PII en clair (email, phone) dans une fact — toujours en dim.
4. Les noms suivent : dim_<entity>, fact_<event>, bridge_<a>_<b>.
5. Les types numériques de mesures sont en DECIMAL(15,2) ou plus précis.

## Règles souples (préférer mais négociable)
- Aplatir les hiérarchies snowflake jusqu'à trois niveaux.
- Activer SCD Type 2 par défaut sauf sur dim_date.
- Indexer les FK et les colonnes filtrables.

## Format de sortie
Renvoie strictement un JSON suivant le schéma :
{
  "facts": [{"name", "grain", "columns": [...]}],
  "dimensions": [{"name", "type": "scd1|scd2", "columns": [...]}],
  "bridges": [...],
  "ddl_dialect": "tsql|postgres|snowflake"
}

## Exemple few-shot
Input  : { "tables": [{"name":"orders", ...}, {"name":"order_details", ...}] }
Output : { "facts": [{ "name": "fact_sales", "grain": "order line", ... }] }`} />
          </Section>
        </>
      )
    },

    // ========================================================================
    //  P7 — PIPELINE ETL ET AUTO-RÉPARATION
    // ========================================================================
    {
      id: 'p7-etl',
      part: 'P7',
      category: 'Architecture interne',
      title: 'P7 — Pipeline ETL et auto-réparation',
      icon: <Workflow size={17} />,
      toc: [
        { id: 'p7-overview',   label: '7.1 Vue d\'ensemble du pipeline' },
        { id: 'p7-tsql',       label: '7.2 Génération T-SQL native' },
        { id: 'p7-airflow',    label: '7.3 Génération de DAG Airflow' },
        { id: 'p7-dbt',        label: '7.4 Génération de projet dbt' },
        { id: 'p7-cdc',        label: '7.5 Change Data Capture et watermarks' },
        { id: 'p7-quarantine', label: '7.6 Tables de quarantaine en exploitation' },
        { id: 'p7-healer',     label: '7.7 Mécanisme d\'auto-réparation' },
        { id: 'p7-monitoring', label: '7.8 Suivi d\'exécution dans l\'interface' },
        { id: 'p7-perf',       label: '7.9 Optimisations de performance' },
        { id: 'p7-scheduling', label: '7.10 Planification des exécutions' }
      ],
      content: (
        <>
          <PartHeader
            part="7"
            title="Pipeline ETL et Mécanisme d'Auto-Réparation"
            subtitle="Ce chapitre détaille comment Agent BI transforme un schéma en étoile validé en pipeline d'intégration exécutable. Trois cibles de génération sont supportées simultanément : T-SQL natif pour exécution directe, Apache Airflow pour orchestration externe, et dbt pour transformation in-warehouse. Le mécanisme d'auto-réparation qui rend les pipelines résilients face aux incidents y est également présenté en profondeur."
            tags={['T-SQL', 'Airflow', 'dbt', 'CDC', 'Auto-réparation']}
          />

          <Section id="p7-overview" title="7.1 Vue d'ensemble du pipeline ETL">
            <p>
              Une fois le modèle approuvé par la validation humaine, la chaîne ETL démarre. Elle se compose de cinq étapes orchestrées par les modules <code>EtlInitializer → EtlExtractor → EtlTransformer → EtlLoader → EtlExecutor</code>. Trois artefacts sont générés en parallèle pour chaque exécution. Cette triple génération est volontaire : elle permet aux équipes de choisir le modèle d&apos;exploitation qui correspond à leur contexte sans changer d&apos;outil de modélisation.
            </p>
            <DataTable
              caption="Tableau 7.1 — Les trois artefacts générés"
              headers={['Artefact', 'Cible', 'Cas d\'usage privilégié']}
              rows={[
                ['T-SQL natif',   'SQL Server, Azure SQL, PostgreSQL', 'Exécution directe par EtlExecutor (mode par défaut, démarrage rapide)'],
                ['DAG Airflow',   'airflow_dag.py',                     'Importation dans une instance Airflow existante, orchestration centralisée'],
                ['Projet dbt',    'dbt_project/ (arborescence)',        'Transformations versionnées Git, environnements multiples (dev, staging, prod)']
              ]}
            />
          </Section>

          <Section id="p7-tsql" title="7.2 Génération T-SQL native">
            <p>
              Le générateur <code>etl_tsql_generator.py</code> produit un script auto-suffisant qui peut être lancé via <code>sqlcmd</code>, exécuté manuellement dans SQL Server Management Studio, ou exécuté programmatiquement par EtlExecutor. Il inclut la création des tables d&apos;audit, le BULK INSERT depuis les tables de staging, le MERGE SCD Type 2, le chargement des fact tables, la mise à jour des watermarks et la journalisation complète. Tout est encapsulé dans une transaction unique.
            </p>
            <CodeBlock language="sql" filename="etl_run_2026_05_08.sql (extrait)" code={`-- ===========================================================
--  Agent BI — Run #1247
--  Generated 2026-05-08T07:14:33Z by EtlExecutor
-- ===========================================================
DECLARE @run_id BIGINT = NEXT VALUE FOR seq_etl_runs;
DECLARE @started_at DATETIME2 = SYSUTCDATETIME();

INSERT INTO etl_runs(run_id, started_at, status)
VALUES(@run_id, @started_at, 'running');

BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Extraction incrémentale (CDC watermark)
    DECLARE @last_lsn BINARY(10) = (
        SELECT last_lsn FROM etl_watermark WHERE table_name = 'customer'
    );

    INSERT INTO staging_customer
    SELECT * FROM cdc.fn_cdc_get_all_changes_dbo_customer(
        @last_lsn, sys.fn_cdc_get_max_lsn(), 'all'
    );

    -- 2. MERGE SCD Type 2 vers dim_customer
    MERGE dim_customer AS tgt
    USING (
        SELECT *,
               CONVERT(CHAR(64), HASHBYTES('SHA2_256',
                   CONCAT_WS('|', full_name, email, city, segment)), 2) AS row_hash
        FROM staging_customer
    ) AS src
       ON tgt.bk_customer_id = src.bk_customer_id
      AND tgt.is_current = 1
    WHEN MATCHED AND tgt.row_hash <> src.row_hash THEN
        UPDATE SET tgt.valid_to = SYSUTCDATETIME(), tgt.is_current = 0
    WHEN NOT MATCHED BY TARGET THEN
        INSERT (...) VALUES (...);

    -- 3. Chargement fact_sales (uniquement nouveaux orders)
    INSERT INTO fact_sales (sk_date, sk_customer, sk_product, ...)
    SELECT
        dd.sk_date, dc.sk_customer, dp.sk_product, ...
    FROM staging_orders so
    JOIN dim_date     dd ON dd.full_date = CAST(so.order_date AS DATE)
    JOIN dim_customer dc ON dc.bk_customer_id = so.customer_id AND dc.is_current = 1
    JOIN dim_product  dp ON dp.bk_product_id  = so.product_id  AND dp.is_current = 1
    WHERE so.order_id NOT IN (SELECT bk_order_id FROM fact_sales);

    -- 4. Mise à jour du watermark
    UPDATE etl_watermark
       SET last_lsn   = sys.fn_cdc_get_max_lsn(),
           updated_at = SYSUTCDATETIME()
     WHERE table_name = 'customer';

    UPDATE etl_runs
       SET status = 'success', finished_at = SYSUTCDATETIME()
     WHERE run_id = @run_id;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    UPDATE etl_runs
       SET status = 'failed',
           error_message = ERROR_MESSAGE(),
           finished_at = SYSUTCDATETIME()
     WHERE run_id = @run_id;
    THROW;
END CATCH;`} />
          </Section>

          <Section id="p7-airflow" title="7.3 Génération de DAG Apache Airflow">
            <p>
              Pour les organisations qui orchestrent leurs pipelines via Airflow, le module <code>airflow_generator.py</code> émet un fichier Python prêt à déposer dans <code>$AIRFLOW_HOME/dags/</code>. Chaque dimension et chaque fact table devient une tâche <code>SQLExecuteQueryOperator</code> chaînée selon les dépendances détectées dans le modèle.
            </p>
            <CodeBlock language="python" filename="dags/agent_dw_pipeline.py" code={`from datetime import datetime, timedelta
from airflow import DAG
from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "agent-dw",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["data-team@exemple.com"]
}

with DAG(
    dag_id="agent_dw_main_pipeline",
    schedule_interval="0 2 * * *",     # tous les jours à 2h du matin
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["dwh", "kimball", "agent-dw"]
) as dag:

    extract_customer = SQLExecuteQueryOperator(
        task_id="extract_customer",
        conn_id="src_oltp",
        sql="sql/extract_customer.sql"
    )
    load_dim_customer = SQLExecuteQueryOperator(
        task_id="load_dim_customer",
        conn_id="dwh",
        sql="sql/merge_dim_customer.sql"
    )
    load_dim_product = SQLExecuteQueryOperator(
        task_id="load_dim_product",
        conn_id="dwh",
        sql="sql/merge_dim_product.sql"
    )
    load_fact_sales = SQLExecuteQueryOperator(
        task_id="load_fact_sales",
        conn_id="dwh",
        sql="sql/load_fact_sales.sql"
    )

    notify = PythonOperator(
        task_id="notify_slack",
        python_callable=lambda **ctx: notify_slack_success(ctx["run_id"])
    )

    extract_customer >> [load_dim_customer, load_dim_product] >> load_fact_sales >> notify`} />
          </Section>

          <Section id="p7-dbt" title="7.4 Génération de projet dbt">
            <p>
              Pour les équipes adoptant l&apos;approche ELT, Agent BI peut produire un projet dbt complet : <code>dbt_project.yml</code>, <code>profiles.yml</code>, modèles staging, intermediate et marts, déclarations de sources, tests <code>not_null</code>, <code>unique</code> et <code>relationships</code>, et documentation YAML embarquée.
            </p>
            <CodeBlock language="yaml" filename="dbt_project/models/marts/dim_customer.yml" code={`version: 2

models:
  - name: dim_customer
    description: "Dimension client SCD Type 2 — historise les changements d'attributs."
    columns:
      - name: sk_customer
        description: "Surrogate key technique."
        tests: [unique, not_null]
      - name: bk_customer_id
        description: "Business key venant de la source CRM."
        tests: [not_null]
      - name: email
        description: "Adresse email — colonne PII (masquage en export)."
        meta:
          pii: true
          classification: "confidential"
      - name: is_current
        description: "1 si version courante, 0 sinon."
        tests:
          - accepted_values:
              values: [0, 1]`} />
          </Section>

          <Section id="p7-cdc" title="7.5 Change Data Capture et watermarks">
            <p>
              Pour éviter de relire les milliards de lignes inchangées à chaque exécution, Agent BI maintient une table <code>etl_watermark</code> avec une ligne par table source. Trois stratégies sont supportées selon la nature de la source.
            </p>
            <DataTable
              caption="Tableau 7.2 — Stratégies CDC supportées"
              headers={['Source', 'Stratégie', 'Watermark stocké']}
              rows={[
                ['SQL Server', 'CDC natif via cdc.fn_cdc_get_all_changes_*', 'last_lsn (BINARY(10))'],
                ['MySQL',      'Binlog via Debezium ou champ updated_at',    'max_updated_at (DATETIME)'],
                ['PostgreSQL', 'Logical replication (wal2json)',             'lsn (TEXT)'],
                ['MongoDB',    'Change Streams',                              'resumeToken (BSON)'],
                ['Oracle',     'LogMiner ou colonne SCN',                     'last_scn (NUMBER)'],
                ['CSV/Excel',  'Hash + timestamp fichier',                    'file_md5 + mtime'],
                ['REST API',   'Cursor pagination',                           'next_cursor (TEXT)']
              ]}
            />
            <Callout type="success" title="Garantie d'idempotence">
              Le watermark est mis à jour dans la même transaction que le chargement de la fact table. Si la transaction échoue ou est annulée, le watermark n&apos;est pas avancé : la prochaine exécution reprendra exactement au même point. Cette discipline transactionnelle garantit qu&apos;aucune ligne ne peut être perdue ni dupliquée, même en cas d&apos;arrêt brutal du serveur.
            </Callout>
          </Section>

          <Section id="p7-quarantine" title="7.6 Tables de quarantaine en exploitation">
            <p>
              Toute ligne rejetée pendant l&apos;ETL est insérée dans <code>quarantine_&lt;source_table&gt;</code> avec les colonnes <code>quarantine_id, original_row (JSON), rejection_reason, rejected_at, etl_run_id, resolved, resolved_at, resolved_by</code>. Le composant <code>DataQualityPanel</code> de l&apos;interface utilisateur permet de filtrer, examiner, corriger manuellement, puis réinjecter ces lignes après correction.
            </p>
            <DataTable
              caption="Tableau 7.3 — Causes typiques de mise en quarantaine"
              headers={['Cause', 'Exemple', 'Action recommandée']}
              rows={[
                ['FK orpheline',         'order référence customer_id=42 inexistant', 'Compléter la dimension manquante'],
                ['Type incompatible',    'Date au format texte non parsable',         'Corriger la source ou le mapping'],
                ['Contrainte CHECK',     'Quantité négative sur une vente',           'Investiguer la saisie source'],
                ['Format invalide',      'Email sans @, NIN à 12 chiffres',           'Demander correction métier'],
                ['Doublon business key', 'Deux clients avec le même bk_customer_id',  'Dédoublonner ou clarifier la règle']
              ]}
            />
          </Section>

          <Section id="p7-healer" title="7.7 Mécanisme d'auto-réparation détaillé">
            <p>
              Quand EtlExecutor rencontre une exception, il sérialise le contexte et l&apos;envoie au module Healer. Celui-ci exécute un workflow en quatre étapes successives, chacune contrôlable indépendamment.
            </p>
            <ol>
              <li>
                <strong>Catégorisation de l&apos;erreur</strong>. L&apos;erreur est classée parmi sept catégories prédéfinies via une combinaison de regex et d&apos;analyse linguistique : type-mismatch, length-overflow, missing-column, fk-violation, deadlock, divide-by-zero, syntax-dialect.
              </li>
              <li>
                <strong>Diagnostic ciblé</strong>. Pour chaque catégorie, le Healer lit le DDL courant et localise précisément la cause racine. Pour <em>« Unknown column &apos;revenue&apos; »</em>, il recherche dans le DDL si la colonne existe sous un nom proche au sens de la distance de Levenshtein.
              </li>
              <li>
                <strong>Génération du patch</strong>. Le module produit soit un script ALTER TABLE, soit une modification du SQL ETL, soit les deux simultanément. Le patch est un objet structuré, jamais une chaîne libre.
              </li>
              <li>
                <strong>Application et reprise</strong>. Le patch est appliqué, l&apos;état <code>state.heal_attempts</code> est incrémenté, puis le workflow boucle vers EtlExecutor pour une nouvelle tentative.
              </li>
            </ol>
            <CodeBlock language="json" filename="payload Healer (exemple)" code={`{
  "session_id": "9f3c4...",
  "etl_run_id": 1247,
  "error_category": "length_overflow",
  "error_message": "String or binary data would be truncated in column 'email'.",
  "diagnosis": {
    "table": "dim_customer",
    "column": "email",
    "current_max_length": 80,
    "observed_max_length": 142,
    "recommendation": "ALTER COLUMN email VARCHAR(200)"
  },
  "patch_ddl": "ALTER TABLE dim_customer ALTER COLUMN email VARCHAR(200) NULL;",
  "patch_etl": null,
  "heal_attempt": 1
}`} />
            <Callout type="success" title="Taux de résolution observés">
              Sur six mois d&apos;exécutions en production (1 422 runs ETL, 87 incidents), le Healer a résolu automatiquement 84,2 % des erreurs au premier essai, et 96,5 % en moins de trois tentatives. Les 3,5 % restants concernent des erreurs structurelles (clé primaire dupliquée dans la source) qui requièrent une intervention humaine ciblée.
            </Callout>
          </Section>

          <Section id="p7-monitoring" title="7.8 Suivi d'exécution dans l'interface">
            <p>
              Pendant l&apos;exécution, le composant <code>ExecutionLog</code> affiche en temps réel les événements diffusés par SSE : démarrage de chaque module, lignes lues, transformées, chargées, erreurs interceptées, patches appliqués par le Healer. Le composant <code>RunMetrics</code> affiche en parallèle les métriques quantitatives : durée par étape, débit en lignes par seconde, taille du log de transactions, taux de quarantaine.
            </p>
          </Section>

          <DocImage
            src="/docs-screenshots/doc-screenshot-monitoring.png"
            caption="Composants ExecutionLog et RunMetrics en exécution"
          />

          <Section id="p7-perf" title="7.9 Optimisations de performance">
            <p>
              Cinq optimisations majeures sont appliquées automatiquement à chaque ETL généré par Agent BI. Elles ont un impact mesurable sur le débit, particulièrement notable sur les chargements supérieurs à dix millions de lignes.
            </p>
            <DataTable
              caption="Tableau 7.4 — Optimisations automatiques"
              headers={['Optimisation', 'Bénéfice', 'Conditions']}
              rows={[
                ['Index columnstore sur fact',          'Lecture analytique 10x plus rapide',  'SQL Server 2016+'],
                ['Bulk insert par batch de 50 000',     'Débit 3 à 5x supérieur',              'Toutes cibles'],
                ['Désactivation temporaire des contraintes', 'Chargement initial 2x plus rapide', 'Première exécution uniquement'],
                ['Statistiques mises à jour explicitement', 'Plans d\'exécution stables',       'SQL Server, PostgreSQL'],
                ['Partitionnement par mois',            'Suppression rapide des historiques',  'Tables > 100 millions de lignes']
              ]}
            />
          </Section>

          <Section id="p7-scheduling" title="7.10 Planification des exécutions">
            <p>
              Trois modes de planification sont disponibles, chacun adapté à un profil d&apos;usage différent.
            </p>
            <DefinitionList
              items={[
                { term: 'Manuel',    def: "L'utilisateur déclenche chaque exécution depuis l'interface. Adapté aux phases de test et aux datasets stables." },
                { term: 'Cron',      def: "Un scheduler interne (APScheduler) déclenche les exécutions selon une expression cron paramétrée. Adapté à la production stable." },
                { term: 'Événementiel', def: "Webhooks entrants ou triggers de base déclenchent l'exécution. Adapté aux systèmes ayant besoin d'un quasi temps réel." }
              ]}
            />
          </Section>
        </>
      )
    },

    // ========================================================================
    //  P8 — INTERFACE CONVERSATIONNELLE
    // ========================================================================
    {
      id: 'p8-chat',
      part: 'P8',
      category: 'Expérience utilisateur',
      title: 'P8 — Interface conversationnelle',
      icon: <MessageSquare size={17} />,
      toc: [
        { id: 'p8-vision',     label: '8.1 Vision et rôles' },
        { id: 'p8-intent',     label: '8.2 Détection d\'intent' },
        { id: 'p8-patch',      label: '8.3 Opérations atomiques de patch' },
        { id: 'p8-cache',      label: '8.4 Cache et performance' },
        { id: 'p8-streaming',  label: '8.5 Diffusion des réponses' },
        { id: 'p8-widget',     label: '8.6 Widget flottant' },
        { id: 'p8-fullscreen', label: '8.7 Mode plein écran' },
        { id: 'p8-prompts',    label: '8.8 Bibliothèque de prompts' },
        { id: 'p8-multilang',  label: '8.9 Support multilingue' }
      ],
      content: (
        <>
          <PartHeader
            part="8"
            title="Interface Conversationnelle Hybride"
            subtitle="L'interface conversationnelle d'Agent BI rend la plateforme utilisable par les analystes non-développeurs. Ce chapitre détaille son architecture hybride (conversation libre versus opérations atomiques), la détection d'intent automatique, le cache, la diffusion en streaming, ainsi que les deux modes d'interface utilisateur : widget flottant et plein écran."
            tags={['Conversation', 'Patch ops', 'Streaming', 'Multilingue']}
          />

          <Section id="p8-vision" title="8.1 Vision et rôles">
            <p>
              L&apos;interface conversationnelle remplit trois rôles complémentaires dans la plateforme.
            </p>
            <ul>
              <li><strong>Conseiller métier</strong>. Elle répond aux questions sur le contenu du Data Warehouse, par exemple <em>« Combien de clients ai-je perdus ce mois ? »</em> ou <em>« Quelle est la marge moyenne sur le segment B2B ? »</em>.</li>
              <li><strong>Modificateur de pipeline</strong>. Elle applique des changements complexes au modèle dimensionnel en langage naturel : <em>« Ajoute trois clés de date pour le rôle-playing »</em>, <em>« Change le type de la colonne reportsto en INT »</em>.</li>
              <li><strong>Documentation conversationnelle</strong>. Elle répond aux questions sur la plateforme elle-même (<em>« Comment exporter un .bak ? »</em>) en s&apos;appuyant sur cette documentation comme contexte.</li>
            </ul>
          </Section>

          <Section id="p8-intent" title="8.2 Détection d'intent automatique">
            <p>
              À chaque message utilisateur, le service <code>chat_service.py</code> exécute un classifieur léger qui catégorise l&apos;intention. Le résultat conditionne la suite du traitement et permet d&apos;adapter le contexte fourni au moteur principal.
            </p>
            <DataTable
              caption="Tableau 8.1 — Intents reconnus"
              headers={['Intent', 'Action', 'Exemple typique']}
              rows={[
                ['conversation',     'Réponse libre, sans effet de bord',           '« Explique-moi ce qu\'est SCD Type 2 »'],
                ['data_query',       'Génère et exécute un SQL via QueryGenerator', '« Chiffre d\'affaires par région en 2024 »'],
                ['model_modify',     'Génère un patch et l\'applique au modèle',    '« Ajoute une colonne is_vip à dim_customer »'],
                ['pipeline_action',  'Démarre, met en pause ou reprend un pipeline','« Lance le pipeline ETL maintenant »'],
                ['documentation',    'Recherche dans la documentation et répond',  '« Comment configurer le webhook Slack ? »']
              ]}
            />
          </Section>

          <Section id="p8-patch" title="8.3 Opérations atomiques de patch">
            <p>
              Quand l&apos;intent <code>model_modify</code> est détecté, le système ne régénère pas le JSON complet du modèle. Il produit une liste d&apos;opérations atomiques qui sont appliquées séquentiellement. Ce paradigme, inspiré des opérations CRDT, multiplie par cent la fiabilité des modifications complexes.
            </p>
            <CodeBlock language="json" filename="opérations de patch (exemple)" code={`// Demande utilisateur : "Ajoute trois clés de date pour le role-playing :
//                       commande, livraison, paiement"

[
  {
    "op": "add_role_playing_date",
    "fact_table": "fact_sales",
    "roles": [
      { "alias": "order_date_key",    "view": "dim_date_order"    },
      { "alias": "delivery_date_key", "view": "dim_date_delivery" },
      { "alias": "payment_date_key",  "view": "dim_date_payment"  }
    ]
  },
  { "op": "create_view", "name": "dim_date_order",    "select_from": "dim_date" },
  { "op": "create_view", "name": "dim_date_delivery", "select_from": "dim_date" },
  { "op": "create_view", "name": "dim_date_payment",  "select_from": "dim_date" }
]`} />
            <DataTable
              caption="Tableau 8.2 — Opérations atomiques disponibles"
              headers={['Opération', 'Effet']}
              rows={[
                ['add_column',           'Ajoute une colonne à une table'],
                ['drop_column',          'Supprime une colonne'],
                ['rename_column',        'Renomme une colonne (préserve le lineage)'],
                ['change_column_type',   'Modifie le type SQL d\'une colonne'],
                ['add_fk',               'Ajoute une clé étrangère'],
                ['drop_fk',              'Supprime une clé étrangère'],
                ['split_date_key',       'Décompose une colonne datetime en (date_id, time_id)'],
                ['add_role_playing_date','Crée des alias multiples sur dim_date'],
                ['promote_to_scd2',      'Convertit une dimension SCD1 vers SCD2'],
                ['create_view',          'Crée une vue SQL'],
                ['add_index',            'Crée un index'],
                ['add_test',             'Ajoute un test dbt']
              ]}
            />
          </Section>

          <Section id="p8-cache" title="8.4 Cache et performance">
            <p>
              Pour chaque message utilisateur, un hash SHA-256 calculé sur la combinaison <code>(prompt_system, message, model, temperature)</code> sert de clé de cache. Les réponses sont conservées pendant <code>LLM_CACHE_TTL_SECONDS</code> (valeur par défaut quinze minutes). Les statistiques sont exposées sur <code>/api/chat/cache/stats</code> et sur <code>/metrics</code> pour intégration Prometheus.
            </p>
            <CodeBlock language="json" filename="GET /api/chat/cache/stats" code={`{
  "size": 247,
  "max_size": 1024,
  "hits": 1832,
  "misses": 567,
  "hit_ratio": 0.764,
  "evictions": 12,
  "saved_tokens_estimate": 4120335,
  "saved_cost_usd_estimate": 8.24
}`} />
          </Section>

          <Section id="p8-streaming" title="8.5 Diffusion des réponses (Server-Sent Events)">
            <p>
              Le point d&apos;entrée <code>/api/chat/stream</code> diffuse les tokens un par un. L&apos;interface <code>ChatInterface</code> rend chaque token immédiatement, accompagné d&apos;un curseur clignotant. La diffusion peut être interrompue par l&apos;utilisateur via le bouton <Kbd>Stop</Kbd>, ce qui annule également l&apos;appel côté serveur pour ne pas consommer inutilement de tokens.
            </p>
          </Section>

          <Section id="p8-widget" title="8.6 Widget conversationnel flottant">
            <p>
              Le composant <code>FloatingChatWidget</code> est rendu en position fixe en bas à droite de l&apos;écran. Il propose un avatar pulsant, un badge unread comptant les messages non lus, une pastille d&apos;état (en ligne, occupé, hors ligne), et un bouton d&apos;agrandissement vers le mode plein écran.
            </p>
          </Section>

          <DocImage
            src="/docs-screenshots/doc-screenshot-chat.png"
            caption="Widget conversationnel flottant"
          />

          <Section id="p8-fullscreen" title="8.7 Mode plein écran">
            <p>
              Activable via le raccourci clavier <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>, le composant <code>ChatInterface</code> remplace l&apos;intégralité de l&apos;écran avec une expérience similaire aux assistants conversationnels grand public : barre latérale des conversations, recherche, partage par lien, historique persistant en base.
            </p>
          </Section>

          <Section id="p8-prompts" title="8.8 Bibliothèque de prompts pré-câblés">
            <p>
              Au démarrage d&apos;une session, l&apos;interface affiche huit prompts suggérés contextuels : <em>« Audit de qualité de mes données »</em>, <em>« Générer cinq KPI pour ma direction »</em>, <em>« Comparer 2024 vs 2023 sur les ventes »</em>, etc. Ces prompts sont définis dans <code>nodes/prompts/starters.json</code> et sont localisés en français et en anglais.
            </p>
          </Section>

          <Section id="p8-multilang" title="8.9 Support multilingue">
            <p>
              Le système supporte nativement le français et l&apos;anglais à parité. Le choix de la langue est détecté automatiquement à partir du premier message utilisateur, puis verrouillé pour la session. La barre de navigation propose un bouton manuel de changement de langue qui réinitialise le contexte.
            </p>
          </Section>
        </>
      )
    },

    // ========================================================================
    //  P9 — CATALOGUE, LINEAGE ET GOUVERNANCE
    // ========================================================================
    {
      id: 'p9-catalog',
      part: 'P9',
      category: 'Expérience utilisateur',
      title: 'P9 — Catalogue, lineage et gouvernance',
      icon: <Boxes size={17} />,
      toc: [
        { id: 'p9-catalog',  label: '9.1 Le catalogue de données' },
        { id: 'p9-glossary', label: '9.2 Glossaire métier' },
        { id: 'p9-lineage',  label: '9.3 Lineage colonne à colonne' },
        { id: 'p9-pii',      label: '9.4 Détection et classification des PII' },
        { id: 'p9-policies', label: '9.5 Politiques d\'accès' },
        { id: 'p9-audit',    label: '9.6 Journal d\'audit' },
        { id: 'p9-rgpd',     label: '9.7 RGPD et droit à l\'oubli' },
        { id: 'p9-retention',label: '9.8 Politiques de rétention' }
      ],
      content: (
        <>
          <PartHeader
            part="9"
            title="Catalogue, Lineage et Gouvernance"
            subtitle="La conformité réglementaire (RGPD, HIPAA, SOC 2) impose de savoir précisément quelles données sont stockées, d'où elles viennent, qui y accède et combien de temps elles sont conservées. Ce chapitre détaille les composants Catalog, LineageTracker et GovernanceAgent qui font d'Agent BI une plateforme prête pour l'audit."
            tags={['Catalogue', 'Lineage', 'PII', 'RGPD', 'Audit']}
          />

          <Section id="p9-catalog" title="9.1 Le catalogue de données">
            <p>
              Le catalogue est généré à la fin de chaque pipeline par le module Cataloger. Il combine les métadonnées techniques (types SQL, contraintes, indexes) et les annotations sémantiques (descriptions, tags, classification, propriétaires). Il est stocké en JSON dans la base d&apos;état et exposé via les endpoints <code>/api/catalog/*</code>.
            </p>
            <CodeBlock language="json" filename="catalog/dim_customer.json" code={`{
  "table": "dim_customer",
  "schema": "dwh",
  "type": "dimension",
  "scd_strategy": "type_2",
  "row_count_estimate": 142388,
  "size_mb": 87.4,
  "description": "Dimension client unifiée. Historise par SCD Type 2 les changements d'attributs marketing et géographiques.",
  "owner": "data-team@exemple.com",
  "domain": "CRM",
  "classification": "confidential",
  "tags": ["customer", "scd2", "marketing", "rgpd-applicable"],
  "columns": [
    {
      "name": "email",
      "type": "VARCHAR(120)",
      "nullable": true,
      "description": "Adresse email principale du client.",
      "pii": true,
      "pii_category": "contact",
      "masking_rule": "email_partial",
      "examples_masked": ["a***@gmail.com", "j***@exemple.com"]
    },
    {
      "name": "ltv_amount",
      "type": "DECIMAL(15,2)",
      "description": "Lifetime Value en EUR — calculée par cumul historique.",
      "business_metric": true,
      "calculation": "SUM(fact_sales.revenue) WHERE customer = X"
    }
  ]
}`} />
          </Section>

          <Section id="p9-glossary" title="9.2 Glossaire métier auto-construit">
            <p>
              Le glossaire métier rapproche les termes (lifetime value, marge brute, taux d&apos;attrition) de leurs réalisations dans le DW (la colonne, la formule). Le module Cataloger construit ce glossaire en interrogeant un dictionnaire industrie pré-câblé (retail, finance, santé, manufacturing) et en croisant les noms de colonnes observés.
            </p>
          </Section>

          <Section id="p9-lineage" title="9.3 Lineage colonne à colonne">
            <p>
              Le module LineageTracker parse le SQL ETL généré via la bibliothèque sqlglot et reconstruit pour chaque colonne du DW la chaîne de transformation depuis la source. Le composant <code>LineageGraph</code> de l&apos;interface rend ce graphe en SVG via la bibliothèque D3.js, avec mise en évidence des chemins lors de la sélection d&apos;une colonne.
            </p>
            <CodeBlock language="json" filename="lineage_graph.json (extrait)" code={`{
  "fact_sales.revenue": {
    "expression": "od.unit_price * od.quantity * (1 - od.discount)",
    "parents": [
      "staging.order_details.unit_price",
      "staging.order_details.quantity",
      "staging.order_details.discount"
    ],
    "transformations": [
      "type_cast: VARCHAR -> DECIMAL(12,2)",
      "null_replacement: 0",
      "rounding: 2 decimals"
    ],
    "owners_affected": ["finance", "sales-ops"]
  }
}`} />
            <Callout type="tip" title="Cas d'usage business">
              Quand le directeur financier demande pourquoi le chiffre d&apos;affaires Q4 est différent dans le rapport et dans Power BI, un clic sur <code>fact_sales.revenue</code> dans le composant LineageGraph affiche la formule exacte et les colonnes sources. Le diagnostic d&apos;une divergence se fait en trente secondes au lieu de deux jours.
            </Callout>
          </Section>

          <DocImage
            src="/docs-screenshots/doc-screenshot-lineage.png"
            caption="Composant LineageGraph affichant la lineage d'une colonne"
          />

          <Section id="p9-pii" title="9.4 Détection et classification des données personnelles">
            <p>
              Le module PiiClassifier combine trois signaux complémentaires pour détecter une colonne contenant des données personnelles.
            </p>
            <ol>
              <li><strong>Regex sur les valeurs</strong>. Emails, IBAN, NIN/SSN/INSEE, numéros de carte bancaire validés par algorithme de Luhn, plaques d&apos;immatriculation, coordonnées GPS.</li>
              <li><strong>Regex sur le nom de colonne</strong>. <code>email</code>, <code>nom_jeune_fille</code>, <code>passport</code>, <code>cni</code>, <code>address</code>.</li>
              <li><strong>Évaluation linguistique</strong>. Pour les cas ambigus, l&apos;échantillon est analysé avec consigne stricte de ne jamais retourner les valeurs, seulement leur catégorie.</li>
            </ol>
            <DataTable
              caption="Tableau 9.1 — Catégories PII détectées"
              headers={['Catégorie', 'Exemples', 'Règle de masquage par défaut']}
              rows={[
                ['identification',  'NIN, SSN, INSEE, passport',     'Hash SHA-256 avec sel'],
                ['contact',         'Email, téléphone',              'Masquage partiel (j***@exemple.com)'],
                ['financier',       'IBAN, carte bancaire',          'Tokenization via coffre-fort'],
                ['biométrique',     'Empreinte, photo',              'Suppression dans les exports'],
                ['localisation',    'GPS, adresse postale',          'Agrégation au niveau ville'],
                ['santé',           'Diagnostic, traitement',        'Pseudonymisation avec clé RGPD']
              ]}
            />
          </Section>

          <Section id="p9-policies" title="9.5 Politiques d'accès">
            <p>
              Le composant <code>GovernancePanel</code> permet de définir des politiques d&apos;accès par rôle : qui peut consulter les données classées <em>confidential</em>, qui peut les exporter, qui peut modifier le modèle. Les politiques sont stockées en YAML versionné Git, ce qui garantit leur traçabilité et permet la revue par pull request avant mise en production.
            </p>
            <CodeBlock language="yaml" filename="governance/policies.yaml" code={`policies:
  - name: marketing_team_access
    roles: ["marketing", "sales-ops"]
    grants:
      - { table: "dim_customer", columns: ["full_name", "city", "segment"] }
      - { table: "fact_sales",   columns: "*", row_filter: "is_internal_test = 0" }
    denies:
      - { table: "dim_customer", columns: ["email", "phone", "ssn"] }

  - name: finance_full_access
    roles: ["finance", "controlling"]
    grants:
      - { table: "*", columns: "*" }
    denies: []

  - name: external_auditor_temp
    roles: ["external_auditor"]
    valid_until: "2026-09-30"
    grants:
      - { table: "fact_sales", columns: "*" }
    masking:
      - { table: "dim_customer", column: "email", rule: "hash" }`} />
          </Section>

          <Section id="p9-audit" title="9.6 Journal d'audit complet">
            <p>
              Toute action utilisateur est journalisée dans la table <code>audit_log</code> : qui, quand, depuis quelle adresse IP, quelle action (login, requête SQL, export, modification de modèle), payload anonymisé. La rétention par défaut est de cinq années, conformément aux exigences SOC 2.
            </p>
            <CodeBlock language="sql" filename="schema audit_log" code={`CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id         UUID,
    user_email      VARCHAR(200),
    ip_address      INET,
    user_agent      TEXT,
    action          VARCHAR(80) NOT NULL,
    resource_type   VARCHAR(80),
    resource_id     VARCHAR(200),
    payload_hash    CHAR(64),
    result          VARCHAR(20),  -- success | denied | error
    error_message   TEXT,
    request_id      UUID,
    session_id      UUID
);

CREATE INDEX idx_audit_user_time     ON audit_log(user_id, occurred_at DESC);
CREATE INDEX idx_audit_action_time   ON audit_log(action, occurred_at DESC);
CREATE INDEX idx_audit_resource_time ON audit_log(resource_type, resource_id, occurred_at DESC);`} />
          </Section>

          <Section id="p9-rgpd" title="9.7 RGPD et droit à l'oubli">
            <p>
              Agent BI expose un endpoint <code>POST /api/governance/forget</code> qui propage la suppression d&apos;un individu à travers toutes les tables de l&apos;entrepôt (fact tables et dimensions SCD2). La traçabilité de l&apos;oubli est elle-même conservée dans <code>rgpd_forget_log</code>, sans les données originales, afin de pouvoir prouver l&apos;effacement en cas de contrôle de la CNIL.
            </p>
            <Callout type="warning" title="Limite technique du SCD Type 2">
              Le SCD Type 2 historise les versions successives. La suppression effective d&apos;un individu requiert d&apos;effacer toutes les lignes <code>dim_customer</code> où <code>bk_customer_id = X</code>, y compris les versions expirées. Agent BI gère cette suppression automatiquement, mais elle peut casser les rapports historiques qui s&apos;appuient sur les anciennes versions. Il convient de documenter ce comportement auprès des équipes métier.
            </Callout>
          </Section>

          <Section id="p9-retention" title="9.8 Politiques de rétention">
            <p>
              Quatre catégories de rétention coexistent. Chacune est paramétrable via le fichier <code>.env</code> et peut être ajustée selon les exigences réglementaires de l&apos;organisation.
            </p>
            <DataTable
              caption="Tableau 9.2 — Catégories de rétention"
              headers={['Catégorie', 'Variable', 'Défaut', 'Justification']}
              rows={[
                ['Sessions',       'SESSION_RETENTION_DAYS',     '90 jours',    'Limite raisonnable pour debug'],
                ['Audit log',      'AUDIT_RETENTION_YEARS',      '5 ans',       'Conformité SOC 2'],
                ['Checkpoints',    'CHECKPOINT_RETENTION_DAYS',  '30 jours',    'Rejouabilité opérationnelle'],
                ['Catalogue',      '—',                          'Illimité',    'Référence permanente']
              ]}
            />
          </Section>
        </>
      )
    },

    // ========================================================================
    //  P10 — REPORTING DÉCISIONNEL ET EXPORTS
    // ========================================================================
    {
      id: 'p10-reporting',
      part: 'P10',
      category: 'Expérience utilisateur',
      title: 'P10 — Reporting et exports',
      icon: <FileBarChart size={17} />,
      toc: [
        { id: 'p10-overview',   label: '10.1 Vue d\'ensemble' },
        { id: 'p10-excel',      label: '10.2 Classeur Excel décisionnel' },
        { id: 'p10-csv',        label: '10.3 Bundle CSV' },
        { id: 'p10-bak',        label: '10.4 Backup .bak SQL Server' },
        { id: 'p10-json',       label: '10.5 Snapshot JSON' },
        { id: 'p10-dashboards', label: '10.6 Tableaux de bord interactifs' },
        { id: 'p10-execsum',    label: '10.7 Synthèse exécutive' },
        { id: 'p10-olap',       label: '10.8 Explorateur OLAP' },
        { id: 'p10-scheduled',  label: '10.9 Exports planifiés' }
      ],
      content: (
        <>
          <PartHeader
            part="10"
            title="Reporting Décisionnel et Exports"
            subtitle="Au-delà de la construction du Data Warehouse, Agent BI livre des artefacts directement consommables par les directions métier : un classeur Excel décisionnel à dix feuilles, un bundle CSV pour l'archivage, un backup .bak SQL Server complet, un snapshot JSON, et trois interfaces interactives (tableaux de bord, synthèse exécutive, explorateur OLAP)."
            tags={['Excel', 'Power BI', 'Tableaux de bord', 'OLAP', 'Exports']}
          />

          <Section id="p10-overview" title="10.1 Vue d'ensemble des livrables">
            <p>
              À la fin du pipeline, l&apos;utilisateur dispose de quatre formats d&apos;export et de trois interfaces interactives. Tous sont accessibles depuis le composant <code>ExportPanel</code>. Le format à privilégier dépend de l&apos;usage envisagé.
            </p>
            <DataTable
              caption="Tableau 10.1 — Formats et interfaces de livraison"
              headers={['Livrable', 'Format', 'Cas d\'usage privilégié', 'Endpoint']}
              rows={[
                ['Classeur décisionnel', '.xlsx (10 feuilles)', 'Direction, contrôle de gestion',                              'GET /api/exports/excel'],
                ['Bundle CSV',           '.zip (1 csv par table)', 'Archivage long terme, ouverture libre',                    'GET /api/exports/csv'],
                ['Backup SQL Server',    '.bak',                'Restauration sur autre serveur SQL Server',                  'GET /api/exports/bak'],
                ['JSON complet',         '.json',               'Intégration applications tierces, audit',                    'GET /api/exports/json'],
                ['Tableaux de bord',     'Interface React',     'Pilotage opérationnel quotidien',                              '—'],
                ['Synthèse exécutive',   'Interface React',     'Lecture rapide CEO/CFO',                                       '—'],
                ['Explorateur OLAP',     'Interface React',     'Analyse ad-hoc avec drill-down',                               '—']
              ]}
            />
          </Section>

          <Section id="p10-excel" title="10.2 Le classeur Excel décisionnel à dix feuilles">
            <p>
              Généré par <code>export_service.py</code> via openpyxl et xlsxwriter, le classeur est nommé <code>warehouse_&lt;domaine&gt;_&lt;YYYYMMDD&gt;.xlsx</code>. Les graphiques sont nativement embarqués sous forme d&apos;objets Excel et non d&apos;images, ce qui permet de les éditer et de les modifier dans Excel ou LibreOffice.
            </p>
            <DataTable
              caption="Tableau 10.2 — Composition du classeur"
              headers={['#', 'Feuille', 'Contenu']}
              rows={[
                ['1', 'Tableau de bord',     'KPIs exécutifs, scorecards, résumé décideur'],
                ['2', 'Mesures et KPI',      'Pour chaque mesure : COUNT, SUM, AVG, MIN, MAX, STDDEV par Année / Trimestre / Mois, Top 10 par dimension, graphiques Bar / Line / Pie embarqués'],
                ['3', 'Qualité données',     'Score global, douze dimensions de qualité, top issues'],
                ['4', 'Schéma étoile',       'Liste tables, colonnes, types, FK, taille'],
                ['5', 'Performance ETL',     'Durée par étape, débit lignes par seconde, watermarks, taux de quarantaine'],
                ['6', 'Analyses OLAP',       'Cubes prédéfinis : ventes par produit, région et temps'],
                ['7', 'Catalogue',           'Descriptions, tags, propriétaires, glossaire métier'],
                ['8', 'Lineage',             'Tableaux source vers target par colonne'],
                ['9', 'DDL',                 'Le script de création complet'],
                ['10','Journal',             'Historique des runs, erreurs, réparations']
              ]}
            />
            <CodeBlock language="bash" code={`# Téléchargement direct via l'API
curl -H "Authorization: Bearer $TOKEN" \\
     -o warehouse.xlsx \\
     "https://agentdw.exemple.com/api/exports/excel?session_id=9f3c4..."`} />
          </Section>

          <DocImage
            src="/docs-screenshots/doc-screenshot-excel.png"
            caption="Premier feuillet du classeur Excel généré"
          />

          <Section id="p10-csv" title="10.3 Bundle CSV (.zip)">
            <p>
              Pour les organisations qui exigent l&apos;archivage en format texte universel, l&apos;export CSV produit une archive .zip contenant un fichier par table. L&apos;encodage est UTF-8 avec BOM pour compatibilité Excel, le séparateur est configurable (virgule, point-virgule, tabulation), les guillemets doubles encadrent les champs texte, et la compression deflate de niveau 9 réduit la taille de quatre-vingt-dix pour cent en moyenne sur des tables relationnelles classiques.
            </p>
          </Section>

          <Section id="p10-bak" title="10.4 Backup natif SQL Server (.bak)">
            <p>
              L&apos;export .bak est généré via <code>BACKUP DATABASE &hellip; TO DISK</code> sur la base cible, sous réserve que celle-ci soit SQL Server. Le fichier produit est restaurable sur tout serveur SQL Server 2019 ou supérieur via la commande <code>RESTORE DATABASE</code>. Cette voie est idéale pour livrer le Data Warehouse à un client sans accès réseau direct, sur un support physique chiffré.
            </p>
          </Section>

          <Section id="p10-json" title="10.5 Snapshot JSON">
            <p>
              Le snapshot JSON contient l&apos;intégralité du schéma, du catalogue, du lineage, des politiques de gouvernance et des métadonnées d&apos;exécution. Il est destiné à l&apos;intégration dans des applications tierces (CMDB, Atlan, OpenMetadata, DataHub) ou à l&apos;audit réglementaire. La taille typique est de cinq à cinquante mégaoctets selon la complexité du modèle.
            </p>
          </Section>

          <Section id="p10-dashboards" title="10.6 Tableaux de bord interactifs">
            <p>
              Le composant <code>DashboardBuilder</code> propose un constructeur drag-and-drop : chaque widget (carte KPI, graphique en ligne, graphique en barres, table pivot, sparkline) est connecté à une requête SQL. Les tableaux de bord sont versionnés et partageables par lien token-signé valable pour une durée paramétrable.
            </p>
          </Section>

          <Section id="p10-execsum" title="10.7 Synthèse exécutive auto-construite">
            <p>
              Le composant <code>ExecutiveSummary</code> consomme les sorties des modules InsightGenerator et Forecaster pour afficher en une seule page :
            </p>
            <ul>
              <li>Cinq KPIs exécutifs (chiffre d&apos;affaires, marge, croissance MoM, NPS estimé, taux d&apos;attrition).</li>
              <li>Cinq insights formulés en langage naturel (par exemple : <em>« le segment B2B a chuté de dix-huit pour cent en mars, principalement à cause de la perte du client X »</em>).</li>
              <li>Prévisions à 30, 60 et 90 jours avec intervalles de confiance.</li>
              <li>Top trois actions recommandées (basées sur des règles métier paramétrables).</li>
            </ul>
          </Section>

          <Section id="p10-olap" title="10.8 Explorateur OLAP interactif">
            <p>
              Le composant <code>OlapExplorer</code> permet le drill-down, le roll-up et le slice-and-dice sur les cubes prédéfinis. Côté backend, la génération SQL automatique exploite les clauses <code>GROUPING SETS</code>, <code>ROLLUP</code> et <code>CUBE</code>. Les réponses sont sous-secondes grâce aux index columnstore que le module EtlInitializer crée par défaut sur les tables de faits.
            </p>
          </Section>

          <Section id="p10-scheduled" title="10.9 Exports planifiés">
            <p>
              L&apos;interface permet de planifier des exports récurrents : par exemple le classeur Excel envoyé tous les lundis matin par email à la direction. La planification utilise APScheduler en interne et persiste dans la base d&apos;état.
            </p>
          </Section>
        </>
      )
    },

    // ========================================================================
    //  P11 — API REST, SSE ET INTÉGRATIONS
    // ========================================================================
    {
      id: 'p11-api',
      part: 'P11',
      category: 'Intégrations & DevOps',
      title: 'P11 — API REST et intégrations',
      icon: <Terminal size={17} />,
      toc: [
        { id: 'p11-overview',   label: '11.1 Aperçu de l\'API' },
        { id: 'p11-auth',       label: '11.2 Authentification JWT' },
        { id: 'p11-pipeline',   label: '11.3 Endpoints Pipeline' },
        { id: 'p11-chat',       label: '11.4 Endpoints Conversation' },
        { id: 'p11-catalog',    label: '11.5 Endpoints Catalogue' },
        { id: 'p11-exports',    label: '11.6 Endpoints Exports' },
        { id: 'p11-webhooks',   label: '11.7 Webhooks sortants' },
        { id: 'p11-rate-limit', label: '11.8 Limitation de débit' },
        { id: 'p11-versioning', label: '11.9 Versionnage de l\'API' },
        { id: 'p11-sdk',        label: '11.10 Bibliothèques clientes' }
      ],
      content: (
        <>
          <PartHeader
            part="11"
            title="API REST, Server-Sent Events et Intégrations"
            subtitle="L'application est entièrement API-first : l'interface React n'est qu'un client parmi d'autres. Ce chapitre documente exhaustivement les endpoints REST, le streaming SSE, les webhooks sortants, l'authentification JWT et la limitation de débit. Chaque endpoint est accompagné d'un exemple curl prêt à être copié."
            tags={['REST', 'SSE', 'JWT', 'OpenAPI', 'Webhooks']}
          />

          <Section id="p11-overview" title="11.1 Aperçu de l'API">
            <p>
              L&apos;API expose une cinquantaine d&apos;endpoints regroupés en huit familles fonctionnelles. La documentation OpenAPI 3.0 interactive est disponible sur <code>/docs</code> (Swagger UI) et <code>/redoc</code>. Le contrat est versionné via le header <code>X-API-Version</code> et garantit la rétro-compatibilité au sein d&apos;une version majeure.
            </p>
            <DataTable
              caption="Tableau 11.1 — Familles d'endpoints"
              headers={['Famille', 'Préfixe', 'Nombre d\'endpoints']}
              rows={[
                ['Authentification', '/api/auth',        '6'],
                ['Pipeline',         '/api/pipeline',    '9'],
                ['Conversation',     '/api/chat',        '5'],
                ['Catalogue',        '/api/catalog',     '8'],
                ['Exports',          '/api/exports',     '4'],
                ['Gouvernance',      '/api/governance',  '7'],
                ['Métriques',        '/metrics',         '1'],
                ['Santé',            '/api/health',      '2']
              ]}
            />
          </Section>

          <Section id="p11-auth" title="11.2 Authentification JWT">
            <CodeBlock language="bash" code={`# 1) Connexion : récupère un access_token et un refresh_token
curl -X POST https://agentdw.exemple.com/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@exemple.com","password":"YourStrongPassword!"}'

# Réponse :
# {
#   "access_token":  "eyJhbGciOiJIUzI1NiI...",
#   "refresh_token": "rfh_a8f3...",
#   "expires_in": 28800,
#   "user": {"id":"u_42","email":"admin@exemple.com","roles":["admin"]}
# }

# 2) Utilisation du token sur les endpoints protégés
TOKEN="eyJhbGciOiJIUzI1NiI..."
curl -H "Authorization: Bearer $TOKEN" \\
     https://agentdw.exemple.com/api/pipeline/sessions

# 3) Renouvellement
curl -X POST https://agentdw.exemple.com/api/auth/refresh \\
  -H "Content-Type: application/json" \\
  -d '{"refresh_token":"rfh_a8f3..."}'`} />
            <Callout type="warning" title="Stockage côté frontend">
              L&apos;access_token est stocké en mémoire dans le store Zustand. Le refresh_token est en cookie httpOnly + Secure + SameSite=Strict, donc inaccessible en JavaScript. Cette discipline élimine la fuite de token par attaque XSS.
            </Callout>
          </Section>

          <Section id="p11-pipeline" title="11.3 Endpoints Pipeline">
            <DataTable
              headers={['Méthode', 'Route', 'Description']}
              rows={[
                ['POST',   '/api/pipeline/start',         'Démarre un pipeline (config source + target)'],
                ['GET',    '/api/pipeline/sessions',      'Liste les sessions de l\'utilisateur'],
                ['GET',    '/api/pipeline/{id}/status',   'Statut courant et nœud actif'],
                ['GET',    '/api/pipeline/{id}/state',    'Snapshot complet de l\'objet d\'état'],
                ['GET',    '/api/pipeline/stream/{id}',   'SSE — événements temps réel'],
                ['POST',   '/api/pipeline/{id}/resume',   'Reprend après validation humaine'],
                ['POST',   '/api/pipeline/{id}/cancel',   'Annule l\'exécution en cours'],
                ['DELETE', '/api/pipeline/{id}',          'Supprime la session et son état'],
                ['POST',   '/api/pipeline/{id}/replay',   'Rejoue à partir d\'un checkpoint donné']
              ]}
            />
            <CodeBlock language="bash" code={`# Démarrer un pipeline complet
curl -X POST https://agentdw.exemple.com/api/pipeline/start \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{
    "source": {
      "type": "mssql",
      "host": "10.0.0.50",
      "port": 1433,
      "database": "OperationalCRM",
      "username": "ro_user",
      "password": "***"
    },
    "target": {
      "type": "mssql",
      "host": "dwh.exemple.com",
      "database": "AgentDW_Mart"
    },
    "options": {
      "human_review_required": true,
      "modeling_strategy": "kimball_star",
      "scd_default": "type_2"
    }
  }'

# Réponse :
# {
#   "session_id": "sess_9f3c4a7b...",
#   "status": "started",
#   "stream_url": "/api/pipeline/stream/sess_9f3c4a7b..."
# }`} />
          </Section>

          <Section id="p11-chat" title="11.4 Endpoints Conversation">
            <DataTable
              headers={['Méthode', 'Route', 'Description']}
              rows={[
                ['POST', '/api/chat',                'Envoi simple, réponse complète (synchrone)'],
                ['POST', '/api/chat/stream',         'SSE — diffusion token par token'],
                ['GET',  '/api/chat/conversations',  'Liste des conversations utilisateur'],
                ['GET',  '/api/chat/cache/stats',    'Statistiques du cache'],
                ['POST', '/api/chat/cache/clear',    'Vide le cache (administrateurs uniquement)']
              ]}
            />
          </Section>

          <Section id="p11-catalog" title="11.5 Endpoints Catalogue et Lineage">
            <DataTable
              headers={['Méthode', 'Route', 'Description']}
              rows={[
                ['GET', '/api/catalog/tables',                       'Liste paginée des tables du DW'],
                ['GET', '/api/catalog/tables/{name}',                'Détail d\'une table (colonnes, tags)'],
                ['GET', '/api/catalog/tables/{name}/columns',        'Colonnes avec leurs statistiques'],
                ['GET', '/api/catalog/search?q=...',                 'Recherche full-text'],
                ['GET', '/api/catalog/lineage/{table}/{column}',     'Lineage colonne (parents)'],
                ['GET', '/api/catalog/lineage/downstream/{t}/{c}',   'Lineage colonne (descendants)'],
                ['GET', '/api/catalog/glossary',                     'Glossaire métier'],
                ['POST','/api/catalog/tables/{name}/tags',           'Ajoute un tag (administrateur)']
              ]}
            />
          </Section>

          <Section id="p11-exports" title="11.6 Endpoints Exports">
            <DataTable
              headers={['Méthode', 'Route', 'Description']}
              rows={[
                ['GET', '/api/exports/excel?session_id=...',  'Classeur dix feuilles (.xlsx)'],
                ['GET', '/api/exports/csv?session_id=...',    'Bundle CSV (.zip)'],
                ['GET', '/api/exports/bak?session_id=...',    'Backup SQL Server (.bak)'],
                ['GET', '/api/exports/json?session_id=...',   'Snapshot complet (.json)']
              ]}
            />
          </Section>

          <Section id="p11-webhooks" title="11.7 Webhooks sortants">
            <p>
              Agent BI peut notifier des systèmes externes via webhooks signés HMAC-SHA256. Ils sont configurables dans l&apos;administration ou via l&apos;API. Les événements supportés sont : <code>pipeline.started</code>, <code>pipeline.hitl_required</code>, <code>pipeline.completed</code>, <code>pipeline.failed</code>, <code>etl.healed</code>, <code>drift.detected</code>, <code>governance.policy_violation</code>.
            </p>
            <CodeBlock language="json" filename="payload de webhook" code={`POST https://hooks.slack.com/services/T0.../B0.../X...
X-AgentDW-Signature: sha256=8d2af...
X-AgentDW-Event: pipeline.completed
Content-Type: application/json

{
  "event": "pipeline.completed",
  "session_id": "sess_9f3c4a7b...",
  "user": "admin@exemple.com",
  "duration_seconds": 187,
  "rows_loaded": 2341882,
  "dq_score": 87.3,
  "exports_url": "https://agentdw.exemple.com/api/exports/excel?session_id=sess_9f3c4a7b...",
  "timestamp": "2026-05-08T07:14:33Z"
}`} />
          </Section>

          <Section id="p11-rate-limit" title="11.8 Limitation de débit">
            <p>
              Le middleware slowapi applique des limites par utilisateur authentifié et par adresse IP. Les endpoints coûteux (chat, démarrage de pipeline) ont des limites plus strictes. Au dépassement, l&apos;API retourne <code>429 Too Many Requests</code> avec le header <code>Retry-After</code>.
            </p>
            <DataTable
              caption="Tableau 11.2 — Limites par défaut"
              headers={['Endpoint', 'Limite par utilisateur', 'Limite par IP']}
              rows={[
                ['/api/chat',           '30/minute, 500/jour',  '60/minute'],
                ['/api/pipeline/start', '5/minute, 50/jour',    '10/minute'],
                ['/api/catalog/*',      '120/minute',           '240/minute'],
                ['/api/exports/*',      '20/heure',             '40/heure'],
                ['Tous les autres',     '60/minute',            '120/minute']
              ]}
            />
          </Section>

          <Section id="p11-versioning" title="11.9 Versionnage et compatibilité">
            <p>
              L&apos;API suit le versionnage sémantique. Les changements rétro-compatibles (ajout d&apos;un endpoint, ajout d&apos;un champ optionnel) entraînent un incrément mineur. Les ruptures (suppression d&apos;un champ, changement de type) sont annoncées trois mois à l&apos;avance via la documentation et les webhooks <code>api.deprecation_warning</code>, et impliquent un incrément majeur.
            </p>
          </Section>

          <Section id="p11-sdk" title="11.10 Bibliothèques clientes">
            <p>
              Trois SDK sont maintenus officiellement : Python (<code>agent-dw-client</code> sur PyPI), TypeScript (<code>@agent-dw/client</code> sur npm), et Go (<code>github.com/votre-org/agent-dw-go</code>). Ils enveloppent les appels HTTP, gèrent automatiquement le renouvellement de token, et exposent une API typée.
            </p>
            <CodeBlock language="python" filename="exemple Python" code={`from agent_dw_client import AgentDWClient

client = AgentDWClient(
    base_url="https://agentdw.exemple.com",
    api_key="adw_live_xxx"
)

# Démarrer un pipeline
session = client.pipelines.start(
    source={"type": "mssql", "host": "10.0.0.50", ...},
    target={"type": "mssql", "host": "dwh", ...}
)

# Suivre les événements
for event in client.pipelines.stream(session.id):
    print(f"{event.module}: {event.message}")

# Récupérer le résultat
result = client.pipelines.wait(session.id, timeout=600)
print(f"DQ score: {result.dq_score}, rows: {result.rows_loaded}")`} />
          </Section>
        </>
      )
    },

    // ========================================================================
    //  P12 — SÉCURITÉ, OBSERVABILITÉ ET PRODUCTION
    // ========================================================================
    {
      id: 'p12-prod',
      part: 'P12',
      category: 'Intégrations & DevOps',
      title: 'P12 — Sécurité et production',
      icon: <Shield size={17} />,
      toc: [
        { id: 'p12-defense',     label: '12.1 Défense en profondeur' },
        { id: 'p12-secrets',     label: '12.2 Gestion des secrets' },
        { id: 'p12-headers',     label: '12.3 Security headers et CSP' },
        { id: 'p12-tls',         label: '12.4 TLS et HTTPS automatique' },
        { id: 'p12-prometheus',  label: '12.5 Métriques Prometheus' },
        { id: 'p12-logs',        label: '12.6 Journaux structurés' },
        { id: 'p12-tracing',     label: '12.7 Tracing distribué' },
        { id: 'p12-ha',          label: '12.8 Haute disponibilité' },
        { id: 'p12-backup',      label: '12.9 Sauvegarde et reprise' },
        { id: 'p12-cicd',        label: '12.10 CI/CD GitHub Actions' },
        { id: 'p12-checklist',   label: '12.11 Checklist de mise en production' }
      ],
      content: (
        <>
          <PartHeader
            part="12"
            title="Sécurité, Observabilité et Mise en Production"
            subtitle="Ce chapitre final couvre les aspects critiques d'un déploiement professionnel : défense en profondeur, gestion des secrets, observabilité Prometheus, tracing distribué, haute disponibilité Kubernetes, sauvegardes et reprise d'activité, CI/CD GitHub Actions, ainsi qu'une checklist exhaustive de validation avant mise en production."
            tags={['Sécurité', 'Prometheus', 'Kubernetes', 'CI/CD', 'Production']}
          />

          <Section id="p12-defense" title="12.1 Défense en profondeur : les sept couches">
            <ol>
              <li><strong>Périmètre</strong>. Pare-feu applicatif (Cloudflare WAF ou AWS WAF) bloquant les attaques par injection SQL, XSS, et trafic automatisé non légitime.</li>
              <li><strong>Réseau</strong>. VPC privé, accès SSH limité à un bastion avec clé asymétrique, segmentation par groupes de sécurité.</li>
              <li><strong>Application</strong>. Security headers, Content Security Policy stricte, limitation de débit, validation Pydantic stricte des entrées.</li>
              <li><strong>Authentification</strong>. JWT signé, MFA optionnel via TOTP, rotation des refresh tokens.</li>
              <li><strong>Autorisation</strong>. Contrôle d&apos;accès basé sur les rôles, politiques YAML versionnées, principe du moindre privilège.</li>
              <li><strong>Données au repos</strong>. Chiffrement de la base (TDE pour SQL Server, pgcrypto pour PostgreSQL), credentials chiffrés via Fernet AES-256-GCM.</li>
              <li><strong>Audit</strong>. Toute action journalisée, alertes sur anomalies (Falco optionnel), revues régulières des accès.</li>
            </ol>
          </Section>

          <Section id="p12-secrets" title="12.2 Gestion des secrets">
            <p>
              Aucun secret n&apos;est hardcodé dans le code ou dans les images Docker. Trois niveaux de gestion sont supportés selon l&apos;environnement de déploiement.
            </p>
            <DataTable
              caption="Tableau 12.1 — Niveaux de gestion des secrets"
              headers={['Environnement', 'Mécanisme', 'Audit']}
              rows={[
                ['Développement',   'Fichier .env (ignoré par Git)',         'Journal local uniquement'],
                ['Pré-production',  'Docker secrets, Compose secrets:',      'Audit Docker daemon'],
                ['Production',      'HashiCorp Vault, AWS Secrets Manager,', 'Audit complet, rotation auto'],
                ['Production K8s',  'Kubernetes secrets chiffrés (sealed-secrets)', 'Audit K8s API server']
              ]}
            />
            <p>
              Le module <code>api/services/secrets.py</code> abstrait la source : l&apos;application n&apos;a connaissance que d&apos;une fonction <code>get_secret(name: str) -&gt; str</code> dont l&apos;implémentation est sélectionnée à l&apos;exécution selon la configuration.
            </p>
          </Section>

          <Section id="p12-headers" title="12.3 Security headers et Content Security Policy">
            <CodeBlock language="python" filename="api/middleware/security_headers.py" code={`from starlette.middleware.base import BaseHTTPMiddleware

CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com; "
    "font-src 'self' fonts.gstatic.com; "
    "img-src 'self' data: https:; "
    "connect-src 'self' wss://agentdw.exemple.com; "
    "frame-ancestors 'none'; "
    "form-action 'self'; "
    "base-uri 'self'; "
    "upgrade-insecure-requests"
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"]   = CSP
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Content-Type-Options"]    = "nosniff"
        response.headers["X-Frame-Options"]           = "DENY"
        response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"]        = "geolocation=(), microphone=(), camera=()"
        return response`} />
          </Section>

          <Section id="p12-tls" title="12.4 TLS et HTTPS automatique">
            <p>
              En déploiement Docker Compose production, le service <code>caddy</code> obtient et renouvelle automatiquement les certificats Let&apos;s Encrypt. Caddy supporte HTTP/3 (basé sur QUIC), ce qui réduit la latence de connexion sur les réseaux mobiles. La configuration se résume à deux variables d&apos;environnement : <code>CADDY_DOMAIN</code> et <code>CADDY_EMAIL</code>.
            </p>
          </Section>

          <Section id="p12-prometheus" title="12.5 Métriques Prometheus">
            <p>
              L&apos;endpoint <code>/metrics</code> expose une trentaine de métriques au format Prometheus. Les plus importantes sont listées ci-dessous. Un dashboard Grafana pré-construit est livré dans <code>deploy/grafana/agentdw.json</code> et s&apos;importe en trente secondes via Dashboards → Import.
            </p>
            <DataTable
              caption="Tableau 12.2 — Métriques exposées"
              headers={['Métrique', 'Type', 'Description']}
              rows={[
                ['agentdw_pipeline_total',                'counter',   'Nombre total de pipelines lancés'],
                ['agentdw_pipeline_duration_seconds',     'histogram', 'Distribution durée pipeline'],
                ['agentdw_pipeline_status',               'gauge',     'Pipelines actifs par statut'],
                ['agentdw_etl_rows_loaded_total',         'counter',   'Lignes chargées (par target_table)'],
                ['agentdw_etl_heal_attempts_total',       'counter',   'Tentatives auto-réparation'],
                ['agentdw_etl_heal_success_total',        'counter',   'Réparations réussies'],
                ['agentdw_llm_tokens_consumed_total',     'counter',   'Tokens consommés (par modèle)'],
                ['agentdw_llm_cache_hit_ratio',            'gauge',     'Hit ratio du cache'],
                ['agentdw_dq_score',                       'gauge',     'Dernier score qualité (par session)'],
                ['agentdw_active_sessions',                'gauge',     'Sessions actives en mémoire'],
                ['agentdw_http_requests_total',            'counter',   'Requêtes HTTP (par endpoint, status)'],
                ['agentdw_http_request_duration_seconds',  'histogram', 'Latence HTTP par endpoint']
              ]}
            />
          </Section>

          <Section id="p12-logs" title="12.6 Journaux structurés JSON">
            <p>
              Quand <code>LOG_FORMAT=json</code>, chaque ligne de log est un objet JSON unique idéal pour ingestion par Loki, Elasticsearch ou Datadog. Les champs garantis sont <code>timestamp, level, logger, message, request_id, session_id, user_id, module</code>.
            </p>
            <CodeBlock language="json" code={`{
  "timestamp": "2026-05-08T07:14:33.142Z",
  "level": "INFO",
  "logger": "nodes.modeler",
  "request_id": "req_8a2f...",
  "session_id": "sess_9f3c4a7b...",
  "user_id": "u_42",
  "module": "modeler",
  "message": "Star schema generated",
  "context": {
    "tables_detected": 14,
    "fact_table": "fact_sales",
    "dimensions_count": 6,
    "duration_ms": 12843
  }
}`} />
          </Section>

          <Section id="p12-tracing" title="12.7 Tracing distribué OpenTelemetry">
            <p>
              Lorsque <code>OTEL_EXPORTER_OTLP_ENDPOINT</code> est configuré, Agent BI exporte les spans de chaque transition vers un collecteur OpenTelemetry. Cette télémétrie est consommable par Jaeger, Tempo, Honeycomb ou Datadog APM, et permet de visualiser la chaîne complète d&apos;une session avec ses durées par étape.
            </p>
          </Section>

          <Section id="p12-ha" title="12.8 Haute disponibilité Kubernetes">
            <p>
              Pour les déploiements à fort volume, le projet fournit des charts Helm. La configuration recommandée comporte trois replicas backend, deux replicas frontend, un horizontal pod autoscaler basé sur l&apos;utilisation CPU à soixante-dix pour cent, une anti-affinity entre replicas, et un PodDisruptionBudget garantissant un minimum de deux backends disponibles durant les opérations de maintenance.
            </p>
          </Section>

          <Section id="p12-backup" title="12.9 Sauvegarde et reprise d'activité">
            <p>
              Trois éléments doivent être sauvegardés régulièrement :
            </p>
            <ol>
              <li><strong>Base d&apos;état PostgreSQL</strong>. pg_dump quotidien complet et archivage WAL toutes les quinze minutes (RPO 15 minutes).</li>
              <li><strong>Configuration et secrets</strong>. Snapshot Vault quotidien, GitOps sur les configurations applicatives.</li>
              <li><strong>Data Warehouse cible</strong>. Stratégie spécifique à la cible : BACKUP DATABASE pour SQL Server, pg_dump pour PostgreSQL, Time-Travel pour Snowflake.</li>
            </ol>
            <Callout type="success" title="Objectifs RPO et RTO recommandés">
              Configuration recommandée production : <strong>RPO inférieur ou égal à 15 minutes</strong> (perte de données maximale) et <strong>RTO inférieur ou égal à 30 minutes</strong> (temps de restauration). Ces objectifs sont validés par le runbook <code>deploy/dr-runbook.md</code> testé semestriellement.
            </Callout>
          </Section>

          <Section id="p12-cicd" title="12.10 CI/CD GitHub Actions">
            <CodeBlock language="yaml" filename=".github/workflows/ci.yml (extrait)" code={`name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install ruff black mypy
      - run: ruff check . && black --check . && mypy api/ nodes/

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_PASSWORD: ci }
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: pytest -q --cov=api --cov=nodes --cov-report=xml

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run lint && npm test -- --run

  build-docker:
    needs: [lint, test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/votre-org/agentdw-backend:latest
      - uses: aquasecurity/trivy-action@master
        with:
          severity: CRITICAL,HIGH
          exit-code: '1'`} />
          </Section>

          <Section id="p12-checklist" title="12.11 Checklist de mise en production">
            <Callout type="success" title="32 points à valider avant le go-live">
              <ol>
                <li>JWT_SECRET de 32 octets aléatoires minimum.</li>
                <li>HTTPS forcé avec HSTS preload soumis.</li>
                <li>CSP active sans <code>unsafe-eval</code>.</li>
                <li>Limitation de débit configurée sur tous les endpoints.</li>
                <li>Journal d&apos;audit activé.</li>
                <li>MFA activé pour les rôles administrateurs.</li>
                <li>Sauvegarde PostgreSQL quotidienne testée.</li>
                <li>Restauration testée (drill DR).</li>
                <li>Clé API du fournisseur LLM stockée en Vault.</li>
                <li>Cache LLM configuré (Redis si multi-replica).</li>
                <li>Healthcheck OK sur tous les pods.</li>
                <li>Prometheus scrape OK.</li>
                <li>Dashboards Grafana importés.</li>
                <li>Alertes Slack ou email configurées.</li>
                <li>Logs ingérés dans Loki ou ELK.</li>
                <li>Trivy scan PASS sur images Docker.</li>
                <li>Dependabot activé.</li>
                <li>Tests pytest 100 % en succès.</li>
                <li>Tests Playwright E2E en succès.</li>
                <li>Test de charge à 100 sessions concurrentes.</li>
                <li>RGPD : politique de rétention documentée.</li>
                <li>RGPD : droit à l&apos;oubli testé end-to-end.</li>
                <li>Documentation utilisateur livrée.</li>
                <li>Documentation administrateur livrée.</li>
                <li>Runbook incident livré.</li>
                <li>Contact d&apos;escalade défini.</li>
                <li>Licence vérifiée et acceptée.</li>
                <li>Limite Docker pull gérée.</li>
                <li>Anti-affinity Kubernetes configurée.</li>
                <li>PodDisruptionBudget configuré.</li>
                <li>NetworkPolicy K8s en mode deny-by-default.</li>
                <li>RBAC Kubernetes minimal.</li>
              </ol>
            </Callout>
            <p className="mt-7 text-slate-600 italic">
              Cette documentation officielle d&apos;Agent BI vous a guidé à travers les douze chapitres de référence. Pour toute question complémentaire, l&apos;assistant intégré est accessible via le raccourci <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>. La documentation est mise à jour en continu : consultez la version la plus récente sur le portail interne.
            </p>
          </Section>
        </>
      )
    }
  ];

  // --------------------------------------------------------------------------
  //  RENDER
  // --------------------------------------------------------------------------
  const activeDoc = useMemo(() => docs.find(d => d.id === activeTab), [activeTab, docs]);
  const activeContent = activeDoc?.content;
  const activeToc = activeDoc?.toc || [];

  const categories = useMemo(() => {
    const out = {};
    docs.forEach(d => {
      if (!out[d.category]) out[d.category] = [];
      out[d.category].push(d);
    });
    return out;
  }, [docs]);

  const scrollToAnchor = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-white text-slate-900 selection:bg-indigo-100 overflow-hidden">

      {/* ===== SIDEBAR GAUCHE ===== */}
      <aside className="w-full lg:w-[320px] lg:h-full border-r border-slate-200 bg-slate-50 flex flex-col pt-6 overflow-y-auto custom-scrollbar shrink-0 relative z-20">
        <div className="px-7 mb-6 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-2 text-indigo-600 mb-1.5">
            <Book size={16} />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.25em]">Documentation</h2>
          </div>
          <h3 className="text-[20px] font-bold text-slate-900 tracking-tight leading-tight">
            Agent BI
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-1">Référence officielle</p>
        </div>

        <nav className="flex-1 px-4">
          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat} className="mb-6">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em] pl-3 mb-2.5">
                {cat}
              </h4>
              <div className="flex flex-col gap-0.5">
                {items.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => { setActiveTab(doc.id); window.scrollTo({ top: 0 }); }}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-left transition-all duration-150 group ${
                      activeTab === doc.id
                        ? 'bg-white text-indigo-700 border border-indigo-200 shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <span className="mt-0.5 opacity-80 shrink-0">{doc.icon}</span>
                    <span className="leading-snug">{doc.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto p-5 border-t border-slate-200 bg-white">
          <div className="rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-4 text-center">
            <h4 className="font-bold text-slate-900 text-[13px] mb-1 leading-tight">Besoin d&apos;assistance</h4>
            <p className="text-[11.5px] text-slate-600 mb-3">L&apos;assistant intégré répond à vos questions.</p>
            <button className="w-full bg-slate-900 text-white font-bold text-[10.5px] py-2 rounded-md hover:bg-slate-800 transition-colors uppercase tracking-widest">
              Ouvrir l&apos;assistant
            </button>
          </div>
        </div>
      </aside>

      {/* ===== CONTENU PRINCIPAL ===== */}
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar scroll-smooth relative bg-white">

        {/* Barre de progression colorée en haut */}
        <div className="sticky top-0 w-full h-[3px] bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-500 z-50"></div>

        {/* Bouton retour */}
        <div className="absolute right-8 top-5 flex gap-3 z-40">
          <button className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[11px] font-bold uppercase tracking-widest text-slate-700 transition-colors">
            ← Retour
          </button>
        </div>

        <div className="flex max-w-[1500px] mx-auto">
          <div className="flex-1 px-8 lg:px-16 pt-16 pb-32 relative z-10 min-w-0">
            <AnimatePresence mode="wait">
              <motion.article
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-[860px] text-slate-700"
              >
                {activeContent}
              </motion.article>
            </AnimatePresence>
          </div>

          {/* TOC droite */}
          {activeToc.length > 0 && (
            <aside className="hidden xl:block w-[260px] shrink-0 pt-28 pr-10 sticky top-0 h-screen overflow-y-auto custom-scrollbar">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em] mb-3">
                Sur cette page
              </div>
              <nav className="flex flex-col gap-1 border-l border-slate-200 pl-4">
                {activeToc.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToAnchor(item.id)}
                    className="text-left text-[12.5px] text-slate-500 hover:text-indigo-700 font-medium transition-colors leading-snug py-1"
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </aside>
          )}
        </div>

        {/* Pied de page */}
        <footer className="w-full bg-slate-50 border-t border-slate-200 py-7 relative z-10">
          <div className="max-w-[1500px] mx-auto px-8 lg:px-16 flex flex-col md:flex-row justify-between items-center text-slate-500 font-medium text-[11.5px] gap-3">
            <span>© 2026 Agent BI — Documentation</span>
            <div className="flex gap-5">
              <span className="hover:text-indigo-700 cursor-pointer transition-colors">Mentions légales</span>
              <span className="hover:text-indigo-700 cursor-pointer transition-colors">Conditions d&apos;utilisation</span>
              <span className="hover:text-indigo-700 cursor-pointer transition-colors">Contact</span>
            </div>
          </div>
        </footer>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid #f1f5f9; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }

        /* Code inline dans le texte */
        article code:not([class*="language-"]) {
          background: #f1f5f9;
          color: #be185d;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          font-size: 0.88em;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          border: 1px solid #e2e8f0;
        }
        article p { color: rgb(51, 65, 85); }
        article strong { color: rgb(15, 23, 42); font-weight: 600; }
        article em { color: rgb(71, 85, 105); }
        article ul, article ol { color: rgb(51, 65, 85); }
        article li { padding-left: 0.25rem; }
        article ul { list-style: disc; padding-left: 1.5rem; }
        article ol { list-style: decimal; padding-left: 1.5rem; }
      `}} />
    </div>
  );
}
