// src/components/LandingPage.jsx
import React, { useState, useEffect } from 'react';
import DemoModal from './DemoModal';
import {
  Network, Search, Shield, Zap, Database, ArrowRight, Terminal,
  Cloud, HardDrive, Globe, Cpu, BrainCircuit, Blocks, Sparkles,
  BarChart4, ArrowUpRight, CheckCircle2, Workflow, MessageSquare,
  Code2, PlayCircle, Waves, Edit3, Loader2, Link2, GitBranch, Rocket, UserCheck, Settings2,
  Sun, Moon, ChevronRight, TrendingUp, Lock, Eye, Gauge,
  Star, Users, Clock, Target, Lightbulb, ChevronDown, ChevronUp,
  Quote, ArrowUp, Menu, X, Monitor, FileJson, Server,
  Figma, Table, MousePointer, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

/* ── Animation variants ── */
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: 'easeOut' } }
};

const slideInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: 'easeOut' } }
};

const slideInRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: 'easeOut' } }
};

const counterAnimation = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

/* ── Counter hook ── */
function useCounter(end, duration = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    const timer = setTimeout(() => requestAnimationFrame(step), 400);
    return () => clearTimeout(timer);
  }, [end, duration]);
  return count;
}

export default function LandingPage({ onEnterDashboard, onSelectSource, user, onAuthOpen, onDocsOpen, onUseCaseOpen, isDarkMode, setIsDarkMode }) {
  const [activeTab, setActiveTab] = useState('explorer');
  const [isPaused, setIsPaused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [showDemo, setShowDemo] = useState(false);

  const { scrollYProgress } = useScroll();
  const showSticky = useTransform(scrollYProgress, [0.05, 0.15], [0, 1]);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ── Agent slideshow data ── */
  const agents = {
    explorer: {
      icon: Search, title: 'Explorer Agent',
      desc: 'Scanne instantanement vos sources de donnees, identifie les schemas existants et extrait les metadonnees de dizaines de bases SQL, NoSQL ou CSV sans effort humain.',
      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200'
    },
    drift_detector: {
      icon: Waves, title: 'Drift Detector',
      desc: 'Surveille les ecarts de schemas en temps reel et previent les ruptures de pipeline avant qu elles n atteignent la production.',
      color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200'
    },
    modeler: {
      icon: Network, title: 'Modeler Agent',
      desc: 'Construit une architecture dimensionnelle parfaite (Flocon/Etoile). Concoit les tables de faits et les dimensions avec une precision d architecte data senior.',
      color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200'
    },
    critic: {
      icon: Shield, title: 'Critic Agent',
      desc: 'Il doute de tout. Cet agent audite le schema genere, corrige les relations manquantes, optimise les cles primaires et garantit l integrite.',
      color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200'
    },
    human_review: {
      icon: CheckCircle2, title: 'Human Review',
      desc: 'Systeme de validation collaborative permettant a un expert d approuver ou rectifier les decisions critiques de l IA (HITL).',
      color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200'
    },
    chat_modifier: {
      icon: MessageSquare, title: 'Chat Modifier',
      desc: 'Affinez vos modeles par simple conversation. L IA comprend vos directives metier et ajuste la structure (DDL) instantanement.',
      color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200'
    },
    etl_tsql_generator: {
      icon: Code2, title: 'ETL Generator',
      desc: 'Traduit automatiquement les modeles logiques en code de transformation robuste (XML Pentaho natif).',
      color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200'
    },
    etl_executor: {
      icon: PlayCircle, title: 'ETL Executor',
      desc: 'Orchestre l execution des flux ETL generes avec un monitoring de performance granulaire, sans jamais crasher.',
      color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200'
    },
    healer: {
      icon: Zap, title: 'Healer Agent',
      desc: 'Tolerance aux pannes native. Si le script ETL plante en base de donnees, le Healer analyse les logs SQL et recrit son code automatiquement.',
      color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200'
    }
  };

  useEffect(() => {
    if (isPaused) return;
    const agentKeys = Object.keys(agents);
    const interval = setInterval(() => {
      setActiveTab(prev => {
        const currentIndex = agentKeys.indexOf(prev);
        return agentKeys[(currentIndex + 1) % agentKeys.length];
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  /* ── Counter values ── */
  const statSources = useCounter(47);
  const statTime = useCounter(95);
  const statAccuracy = useCounter(99);
  const statUsers = useCounter(1200);

  /* ── Testimonials ── */
  const testimonials = [
    {
      name: 'Karim B.', role: 'Chief Data Officer', company: 'Sonelgaz',
      text: 'Nous avons reduit le temps de conception de notre Data Warehouse de 3 mois a 3 jours. Les agents IA sont incroyablement precis et autonomes.',
      stars: 5
    },
    {
      name: 'Amina L.', role: 'Data Engineer', company: 'Djezzy',
      text: 'Le Critic Agent a detecte des erreurs de relation que notre equipe avait manquees. C est comme avoir un architecte data senior disponible 24/7.',
      stars: 5
    },
    {
      name: 'Youssef M.', role: 'BI Manager', company: 'Cevital',
      text: 'L integration avec Pentaho est transparente. Nous generons des flux ETL production-ready sans ecrire une seule ligne de code.',
      stars: 5
    }
  ];

  /* ── FAQ ── */
  const faqs = [
    { q: 'Comment fonctionne l exploration automatique des sources ?', a: 'L Explorer Agent se connecte a votre base de donnees (SQL Server, PostgreSQL, MySQL, Oracle, SQLite, ou meme des fichiers CSV/Excel) et extrait automatiquement les metadonnees : tables, colonnes, types, cles primaires et etrangeres, sans aucune configuration manuelle.' },
    { q: 'Puis-je modifier le schema genere par l IA ?', a: 'Absolument. Le Chat Modifier vous permet d affiner le modele par simple conversation. Vous pouvez aussi utiliser le Human Review pour valider chaque etape critique avant le deploiement.' },
    { q: 'Quelles sont les sources de donnees supportees ?', a: 'SQL Server (y compris les fichiers .bak), PostgreSQL, MySQL, MariaDB, SQLite, Oracle, ainsi que les fichiers CSV, Excel, et les APIs REST. Le Drift Detector surveille les evolutions de schema en continu.' },
    { q: 'Le code ETL genere est-il production-ready ?', a: 'Oui. Le ETL Generator produit du XML Pentaho Data Integration (PDI) natif, optimise pour les performances. Le Healer Agent corrige automatiquement les erreurs d execution sans intervention humaine.' },
    { q: 'Mes donnees sont-elles securisees ?', a: 'Toutes les connexions sont chiffrees. Les credentials ne sont jamais stockes en clair. Le modele governance integre le masquage des donnees sensibles (PII) conforme au RGPD.' },
    { q: 'Quel est le prix pour une petite equipe ?', a: 'Le plan Annuel a 1 000 DA/utilisateur/mois est ideal pour les equipes de 2 a 10 personnes. Un essai gratuit de 3 jours est disponible sans carte bancaire.' }
  ];

  /* ── Steps ── */
  const steps = [
    { icon: Database, title: 'Connectez votre source', desc: 'En quelques clics, connectez n importe quelle base de donnees, fichier CSV, ou API. Support natif de 8 moteurs de base de donnees.' },
    { icon: BrainCircuit, title: 'Laissez l IA modeliser', desc: 'Nos 9 agents IA analysent, modelisent, auditent et generent automatiquement le schema en etoile ou flocon optimal pour votre cas d usage.' },
    { icon: Code2, title: 'Generez les flux ETL', desc: 'Le code Pentaho PDI est genere automatiquement. Schedules, transformations, mappings : tout est pris en charge sans ecrire de code.' },
    { icon: BarChart4, title: 'Analysez & Optimisez', desc: 'Explorez vos donnees via le Query Generator, suivez la lignage complet, et recevez des insights automatiques bases sur l IA generative.' }
  ];

  return (
    <div className="relative w-full min-h-screen flex flex-col items-center overflow-x-hidden font-sans pb-20" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── Floating gradient orbs (light mode friendly) ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-400/8 blur-[180px]"></div>
        <div className="absolute top-[30%] right-[5%] w-[40%] h-[40%] rounded-full bg-sky-400/8 blur-[160px]"></div>
        <div className="absolute bottom-[0%] left-[30%] w-[35%] h-[35%] rounded-full bg-violet-400/8 blur-[140px]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-[size:80px_80px] opacity-60 [mask-image:radial-gradient(ellipse_80%_100%_at_50%_0%,#000_20%,transparent_100%)]"></div>
      </div>

      {/* ── Navigation ── */}
      <nav className="fixed top-0 inset-x-0 z-[100] w-full border-b backdrop-blur-2xl transition-colors duration-500" style={{ background: 'rgba(246,248,255,0.85)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center cursor-pointer relative z-20" onClick={onEnterDashboard}>
            <img src="/image-removebg-preview(21).png" alt="Agent BI" className="h-14 md:h-20 w-auto object-contain hover:scale-105 transition-all" />
          </div>

          <div className="hidden lg:flex items-center gap-8 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <button onClick={(e) => scrollToSection(e, 'platform')} className="hover:text-indigo-600 transition-colors cursor-pointer">Plateforme IA</button>
            <button onClick={(e) => scrollToSection(e, 'howitworks')} className="hover:text-indigo-600 transition-colors cursor-pointer">Comment ca marche</button>
            <button onClick={(e) => scrollToSection(e, 'pricing')} className="hover:text-indigo-600 transition-colors cursor-pointer">Tarifs</button>
            <button onClick={onDocsOpen} className="hover:text-indigo-600 transition-colors cursor-pointer">Documentation</button>
            <button onClick={onUseCaseOpen} className="hover:text-indigo-600 transition-colors cursor-pointer">Cas d usage</button>
          </div>

          <div className="flex items-center gap-4 relative z-20">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-xl border transition-all duration-300 hover:scale-105" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: isDarkMode ? '#fbbf24' : '#6366f1' }} title={isDarkMode ? 'Mode Clair' : 'Mode Sombre'}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? null : (
              <button onClick={onAuthOpen} className="hidden sm:block text-sm font-semibold transition-colors" style={{ color: 'var(--text-secondary)' }}>Se connecter</button>
            )}
            <button onClick={onSelectSource} className="text-sm font-bold text-white px-5 py-2.5 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-md" style={{ background: 'var(--grad-primary)', boxShadow: '0 2px 12px rgba(61,106,232,0.25)' }}>
              Commencer
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="lg:hidden overflow-hidden border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <div className="px-6 py-4 flex flex-col gap-3 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <button onClick={(e) => { scrollToSection(e, 'platform'); setMobileMenuOpen(false); }}>Plateforme IA</button>
                <button onClick={(e) => { scrollToSection(e, 'howitworks'); setMobileMenuOpen(false); }}>Comment ca marche</button>
                <button onClick={(e) => { scrollToSection(e, 'pricing'); setMobileMenuOpen(false); }}>Tarifs</button>
                <button onClick={() => { onDocsOpen(); setMobileMenuOpen(false); }}>Documentation</button>
                <button onClick={() => { onUseCaseOpen(); setMobileMenuOpen(false); }}>Cas d usage</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── HERO ── */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-36 pb-24 md:pt-44 md:pb-32 flex flex-col items-center">
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="w-full flex flex-col items-center text-center">

          {/* Headline */}
          <motion.h1 variants={fadeInUp} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6 max-w-5xl" style={{ color: 'var(--text-primary)' }}>
            De vos donnees brutes a un{' '}
            <span className="gradient-text">Data Warehouse intelligent</span>{' '}
            en quelques minutes
          </motion.h1>

          <motion.p variants={fadeInUp} className="text-lg md:text-xl max-w-3xl mb-10 font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Ne perdez plus des mois a concevoir votre architecture analytique. Nos 9 agents IA specialises explorent, modelisent, generent et deployent automatiquement votre infrastructure data — de l ingestion a l analyse.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center mb-16">
            <button onClick={onSelectSource} className="group relative flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 text-white rounded-2xl font-semibold text-lg transition-all overflow-hidden active:scale-[0.98] hover:shadow-lg hover:shadow-indigo-500/20" style={{ background: 'var(--grad-primary)' }}>
              <Database size={20} className="group-hover:-translate-y-0.5 transition-transform text-white/80" />
              Essai gratuit — 3 jours
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => setShowDemo(true)} className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 rounded-2xl font-semibold text-lg transition-all active:scale-[0.98] border hover:bg-slate-50" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>
              <PlayCircle size={20} style={{ color: 'var(--text-muted)' }} /> Voir la demo
            </button>
          </motion.div>

          {/* Hero visual / abstract pipeline */}
          <motion.div variants={scaleIn} className="w-full max-w-5xl relative">
            <div className="rounded-3xl border p-1 shadow-2xl shadow-indigo-900/5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <div className="rounded-2xl p-6 md:p-10 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)' }}>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  {[
                    { icon: Database, label: 'Sources', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                    { icon: BrainCircuit, label: 'Modelisation IA', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
                    { icon: Code2, label: 'Generation ETL', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
                    { icon: Zap, label: 'Execution', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
                    { icon: BarChart4, label: 'Analytics', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' }
                  ].map((step, i) => (
                    <React.Fragment key={i}>
                      <motion.div whileHover={{ y: -4 }} className={`flex flex-col items-center gap-3 p-5 rounded-2xl border ${step.border} ${step.bg} transition-all`}>
                        <step.icon size={28} className={step.color} />
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{step.label}</span>
                      </motion.div>
                      {i < 4 && (
                        <div className="hidden md:flex items-center justify-center">
                          <motion.div animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}>
                            <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
                          </motion.div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                {/* Decorative bottom line */}
                <div className="mt-6 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <motion.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} className="h-full rounded-full" style={{ background: 'var(--grad-primary)' }} />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* ── STATS ── */}
      <section className="relative z-10 w-full py-16 border-y" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: statSources, suffix: '+', label: 'Sources supportees' },
            { value: statTime, suffix: '%', label: 'Temps gagne' },
            { value: statAccuracy, suffix: '%', label: 'Precision IA' },
            { value: statUsers, suffix: '+', label: 'Utilisateurs actifs' }
          ].map((stat, i) => (
            <motion.div key={i} variants={counterAnimation} className="flex flex-col items-center text-center">
              <div className="text-4xl md:text-5xl font-black gradient-text mb-2">{stat.value}{stat.suffix}</div>
              <div className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── INTEGRATIONS ── */}
      <section className="relative z-10 w-full py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Sources & Integrations</h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Connectez n importe quelle source de donnees en quelques clics. Plus de 47 connecteurs natifs prets a l emploi.
            </p>
          </motion.div>
          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8">
            {[
              { img: '/integrations/sqlserver.png', label: 'SQL Server' },
              { img: '/integrations/postgresql.png', label: 'PostgreSQL' },
              { img: '/integrations/mysql.png', label: 'MySQL' },
              { img: '/integrations/oracle.png', label: 'Oracle' },
              { img: '/integrations/sqlite.png', label: 'SQLite' },
              { img: '/integrations/snowflake.png', label: 'Snowflake' },
              { img: '/integrations/bigquery.png', label: 'BigQuery' },
              { img: '/integrations/mongodb.png', label: 'MongoDB' },
              { img: '/integrations/restapi.png', label: 'REST API' },
              { img: '/integrations/csv.png', label: 'CSV' },
              { img: '/integrations/excel.png', label: 'Excel' },
              { img: '/integrations/webscraping.png', label: 'Web Scraping' },
              { img: '/integrations/kafka.png', label: 'Kafka' },
              { img: '/integrations/airflow.png', label: 'Airflow' },
              { img: '/integrations/spark.png', label: 'Spark' },
              { img: '/integrations/dbt.png', label: 'dbt' },
            ].map((src, i) => (
              <motion.div
                key={i}
                variants={scaleIn}
                whileHover={{ scale: 1.08, y: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="group flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all hover:shadow-xl cursor-pointer"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.25)]"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(245,248,255,0.9) 100%)' }}
                >
                  <img
                    src={src.img}
                    alt={src.label}
                    className="w-[70%] h-[70%] object-contain transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <span className="text-sm font-bold text-center group-hover:text-indigo-600 transition-colors" style={{ color: 'var(--text-secondary)' }}>{src.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── BEFORE / AFTER ── */}
      <section className="relative z-10 w-full py-20 md:py-28 border-y" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Avant vs Apres Agent BI</h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>Ce que ca change reellement au quotidien de votre equipe data.</p>
          </motion.div>
          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* BEFORE */}
            <motion.div variants={slideInLeft} className="rounded-[28px] border p-8" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)' }}>
                  <Clock size={20} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Avant</h3>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Temps de conception', val: '3 a 6 mois' },
                  { label: 'Equipe requise', val: '5 ingenieurs data' },
                  { label: 'Code ETL ecrit', val: '10 000+ lignes' },
                  { label: 'Tests & debugging', val: '2 a 4 semaines' },
                  { label: 'Cout total', val: '2.5M DA / an' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-base)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="text-sm font-bold text-red-500">{item.val}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            {/* AFTER */}
            <motion.div variants={slideInRight} className="rounded-[28px] border p-8 relative overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'rgba(61,106,232,0.15)' }}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(61,106,232,0.06)_0,transparent_50%)]" />
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
                  <Zap size={20} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Apres Agent BI</h3>
              </div>
              <div className="space-y-4 relative z-10">
                {[
                  { label: 'Temps de conception', val: '7 minutes', highlight: true },
                  { label: 'Equipe requise', val: '1 personne', highlight: true },
                  { label: 'Code ETL ecrit', val: 'Zero ligne', highlight: true },
                  { label: 'Tests & debugging', val: 'Auto-healing', highlight: true },
                  { label: 'Cout total', val: '12 000 DA / an', highlight: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border" style={{ background: item.highlight ? 'rgba(16,185,129,0.04)' : 'var(--bg-base)', borderColor: item.highlight ? 'rgba(16,185,129,0.1)' : 'transparent' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="text-sm font-bold text-emerald-600">{item.val}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="howitworks" className="relative z-10 w-full py-24 md:py-32" style={{ scrollMarginTop: '100px' }}>
        <div className="max-w-7xl mx-auto px-6">
          <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Comment ca marche ?</h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Un pipeline entierement automatise, de l exploration des sources jusqu a l analyse en passant par la generation de code ETL.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div key={i} variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} custom={i} className="group relative rounded-3xl border p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg" style={{ background: 'var(--grad-primary)' }}>
                  <step.icon size={26} />
                </div>
                <div className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Etape {i + 1}</div>
                <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step.desc}</p>
                {i < 3 && <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10"><ArrowRight size={18} style={{ color: 'var(--text-dim)' }} /></div>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE FLOW ── */}
      <section className="relative z-10 w-full py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Architecture Multi-Agents</h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              9 agents IA specialises communiquent en boucle fermee pour livrer un Data Warehouse operationnel sans ecrire une seule ligne de code.
            </p>
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative">
            {/* Horizontal flow for desktop */}
            <div className="hidden lg:flex items-center justify-between gap-4 max-w-5xl mx-auto mb-10">
              {[
                { icon: Search, label: 'Explorer', color: '#10b981' },
                { icon: Waves, label: 'Drift', color: '#06b6d4' },
                { icon: BrainCircuit, label: 'Modeler', color: '#a855f7' },
                { icon: ShieldCheck, label: 'Critic', color: '#f59e0b' },
                { icon: UserCheck, label: 'Human', color: '#f59e0b' },
                { icon: MessageSquare, label: 'Chat', color: '#6366f1' },
                { icon: Settings2, label: 'Generator', color: '#10b981' },
                { icon: Rocket, label: 'Executor', color: '#ec4899' },
                { icon: Zap, label: 'Healer', color: '#f43f5e' },
              ].map((agent, i) => {
                const Icon = agent.icon;
                return (
                  <React.Fragment key={i}>
                    <motion.div variants={scaleIn} className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center border transition-all hover:scale-110" style={{ background: `${agent.color}10`, borderColor: `${agent.color}30` }}>
                        <Icon size={22} style={{ color: agent.color }} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{agent.label}</span>
                    </motion.div>
                    {i < 8 && (
                      <motion.div variants={fadeIn} className="flex-1 h-px mx-2" style={{ background: 'linear-gradient(90deg, var(--border-subtle), var(--border-default), var(--border-subtle))' }}>
                        <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-4 h-full bg-indigo-400/30" />
                      </motion.div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Agent cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Search, title: 'Explorer Agent', desc: 'Decouverte automatique de schemas, metadonnees et relations', color: '#10b981', delay: 0 },
                { icon: Waves, title: 'Drift Detector', desc: 'Surveillance des evolutions de schema en temps reel', color: '#06b6d4', delay: 0.1 },
                { icon: BrainCircuit, title: 'Modeler Agent', desc: 'Conception du modele dimensionnel Etoile/Flocon optimal', color: '#a855f7', delay: 0.2 },
                { icon: ShieldCheck, title: 'Critic Agent', desc: 'Audit automatique : PK/FK, index, integrite referentielle', color: '#f59e0b', delay: 0.3 },
                { icon: UserCheck, title: 'Human Review', desc: 'Validation HITL par un expert avant chaque etape critique', color: '#f59e0b', delay: 0.4 },
                { icon: MessageSquare, title: 'Chat Modifier', desc: 'Ajustez le modele par simple conversation en francais', color: '#6366f1', delay: 0.5 },
                { icon: Settings2, title: 'ETL Generator', desc: 'Generation automatique du code Pentaho PDI XML', color: '#10b981', delay: 0.6 },
                { icon: Rocket, title: 'ETL Executor', desc: 'Orchestration et monitoring des flux de donnees', color: '#ec4899', delay: 0.7 },
                { icon: Zap, title: 'Healer Agent', desc: 'Auto-correction des erreurs d execution sans intervention', color: '#f43f5e', delay: 0.8 },
              ].map((agent, i) => {
                const Icon = agent.icon;
                return (
                  <motion.div
                    key={i}
                    variants={fadeInUp}
                    className="flex items-start gap-4 p-5 rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-lg"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${agent.color}12` }}>
                      <Icon size={20} style={{ color: agent.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white mb-1">{agent.title}</div>
                      <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{agent.desc}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── AGENT SLIDESHOW (preserved, light-adapted) ── */}
      <section id="platform" className="relative z-10 w-full py-24 md:py-32 border-y" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', scrollMarginTop: '100px' }}>
        <div className="max-w-7xl mx-auto px-6">
          <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Orchestration Parfaite</h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Laissez nos 9 agents IA specialises travailler en harmonie pour ingerer, modeliser et deployer votre Data Warehouse sans aucune intervention manuelle.
            </p>
          </motion.div>

          <div className="flex flex-col items-center">
            <div onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)} className="w-full max-w-3xl h-[400px] rounded-[32px] border p-10 relative flex items-center justify-center overflow-hidden shadow-2xl group transition-all duration-500 hover:border-indigo-300" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

              <AnimatePresence mode="wait">
                {/* ... explorer ... */}
                {activeTab === 'explorer' && (
                  <motion.div key="explorer" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0,transparent_60%)]"></div>
                    <Search size={120} className="text-emerald-400/30 mb-12" />
                    <div className="flex gap-8 mb-10 relative z-10">
                      {[Database, Cloud, HardDrive, Globe].map((Ic, i) => (
                        <motion.div key={i} animate={{ y: [0, -15, 0] }} transition={{ duration: 2.5, delay: i * 0.3, repeat: Infinity }} className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center backdrop-blur-md">
                          <Ic size={32} className="text-emerald-500" />
                        </motion.div>
                      ))}
                    </div>
                    <div className="w-80 h-3 rounded-full overflow-hidden relative z-10 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                      <motion.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 2, repeat: Infinity }} className="h-full bg-emerald-500 rounded-full"></motion.div>
                    </div>
                    <p className="mt-6 font-mono text-emerald-600 text-sm font-bold tracking-widest relative z-10 uppercase italic">Ingesting Deep Metadata...</p>
                  </motion.div>
                )}

                {/* ... modeler ... */}
                {activeTab === 'modeler' && (
                  <motion.div key="modeler" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08)_0,transparent_60%)]"></div>
                    <Network size={140} className="text-blue-400/20 absolute blur-[2px]" />
                    <div className="grid grid-cols-3 gap-10 relative z-10 scale-125">
                      <motion.div animate={{ rotateY: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} className="w-32 h-32 bg-blue-50 rounded-[32px] border-2 border-blue-200 backdrop-blur-xl flex flex-col items-center justify-center shadow-lg">
                        <Blocks size={40} className="text-blue-500 mb-3" />
                        <span className="text-[12px] uppercase font-black text-blue-700">Fact_Sales</span>
                      </motion.div>
                      <div className="w-28 h-28 rounded-3xl border flex flex-col items-center justify-center translate-y-20" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
                        <span className="text-[11px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Dim_Date</span>
                      </div>
                      <div className="w-28 h-28 rounded-3xl border flex flex-col items-center justify-center -translate-y-20" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
                        <span className="text-[11px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Dim_Prod</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ... critic ... */}
                {activeTab === 'critic' && (
                  <motion.div key="critic" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.08)_0,transparent_60%)]"></div>
                    <div className="w-96 rounded-3xl p-8 shadow-2xl relative z-10 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
                      <div className="flex items-center gap-4 mb-8 border-b pb-5" style={{ borderColor: 'var(--border-subtle)' }}>
                        <Shield className="text-purple-500" size={24} />
                        <span className="text-lg font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Critic Report</span>
                      </div>
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 text-base font-bold" style={{ color: 'var(--text-primary)' }}><CheckCircle2 size={24} className="text-emerald-500" /> Mapping Correct</div>
                        <div className="flex items-center gap-4 text-base font-bold" style={{ color: 'var(--text-primary)' }}><CheckCircle2 size={24} className="text-emerald-500" /> PK/FK Constrain OK</div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, repeat: Infinity, repeatType: 'reverse', duration: 1 }} className="flex items-center gap-4 text-base font-bold text-purple-600 font-mono italic">
                          {'>>'} SYNTHESIZING DDL...
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ... healer ... */}
                {activeTab === 'healer' && (
                  <motion.div key="healer" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.08)_0,transparent_60%)]"></div>
                    <Zap size={200} className="text-rose-300/20 absolute animate-pulse rotate-12" />
                    <div className="relative z-10 text-center w-full max-w-lg">
                      <div className="flex flex-col items-center p-10 rounded-[40px] border backdrop-blur-3xl shadow-2xl" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
                        <Terminal size={48} className="text-rose-500 mb-8" />
                        <div className="font-mono text-sm w-full p-6 rounded-2xl text-left border mb-8" style={{ background: 'var(--bg-void)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                          {'>'} ERROR 1064 (42000)<br />
                          {'>'} FIXING SCHEMA AUTO...
                        </div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex items-center justify-center gap-4 text-emerald-600 text-lg font-black w-full py-5 rounded-2xl border" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' }}>
                          <CheckCircle2 size={24} /> RESOLVED BY AI
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ... drift ... */}
                {activeTab === 'drift_detector' && (
                  <motion.div key="drift" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08)_0,transparent_60%)]"></div>
                    <div className="w-full max-w-lg flex items-center justify-between relative z-10 p-10">
                      <div className="w-32 h-32 rounded-[32px] border shadow-xl flex flex-col items-center justify-center" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
                        <Database size={40} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>Input_DB</span>
                      </div>
                      <div className="flex-1 px-8 relative overflow-hidden h-10 flex items-center">
                        <div className="absolute w-full h-1 bg-cyan-200 left-0 top-1/2 -translate-y-1/2 rounded-full"></div>
                        <motion.div animate={{ x: ['-20%', '120%'] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }} className="absolute z-10 text-cyan-500 top-1/2 -translate-y-1/2">
                          <Waves size={32} />
                        </motion.div>
                      </div>
                      <div className="w-32 h-32 rounded-[32px] border-2 border-cyan-300 shadow-glow flex flex-col items-center justify-center relative overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <div className="absolute inset-0 bg-cyan-400/5 animate-pulse"></div>
                        <GitBranch size={40} className="text-cyan-500 mb-2 relative z-10" />
                        <span className="text-[10px] font-mono text-cyan-600 relative z-10 uppercase tracking-tighter">DW_Sync</span>
                      </div>
                    </div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-12 bg-cyan-50 border border-cyan-200 text-cyan-700 font-mono text-sm px-8 py-4 rounded-2xl relative z-10">
                      {'>'} DRIFT DETECTED: NEW FIELD REVENUE_2<br />
                      {'>'} AUTO-SCALING DW INFRA...
                    </motion.div>
                  </motion.div>
                )}

                {/* ... human ... */}
                {activeTab === 'human_review' && (
                  <motion.div key="human" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08)_0,transparent_60%)]"></div>
                    <div className="rounded-[40px] w-[450px] overflow-hidden shadow-2xl relative z-10 scale-110 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
                      <div className="p-6 text-center border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                        <span className="text-sm font-black text-amber-600 uppercase flex items-center justify-center gap-3 tracking-[0.2em]"><UserCheck size={20} /> Manual Verification Required</span>
                      </div>
                      <div className="p-10">
                        <p className="text-sm mb-8 font-medium" style={{ color: 'var(--text-secondary)' }}>L Agent Modelisateur a suggere une mise a jour de cle primaire. Confirmez-vous ?</p>
                        <div className="flex gap-4">
                          <motion.button whileHover={{ scale: 1.05 }} className="flex-1 py-4 text-[10px] font-black bg-amber-500 text-white rounded-2xl uppercase tracking-widest shadow-lg shadow-amber-500/20">Approuver</motion.button>
                          <motion.button whileHover={{ scale: 1.05 }} className="flex-1 py-4 text-[10px] font-black rounded-2xl uppercase tracking-widest border hover:bg-slate-50" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>Rejeter</motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ... chat ... */}
                {activeTab === 'chat_modifier' && (
                  <motion.div key="chat" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0,transparent_60%)]"></div>
                    <div className="w-[450px] h-72 border rounded-[40px] flex flex-col shadow-2xl relative z-10 overflow-hidden scale-110" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
                      <div className="h-12 border-b flex items-center px-6 gap-3" style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'var(--border-subtle)' }}>
                        <MessageSquare size={16} className="text-indigo-500" />
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Neural Interactor</span>
                      </div>
                      <div className="flex-1 p-8 flex flex-col justify-end gap-6 overflow-hidden">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="self-start p-4 rounded-3xl text-[11px] max-w-[85%] rounded-tl-none border" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                          Audit found redundancies. Fusion DIM_USER and DIM_PROFIL?
                        </motion.div>
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 }} className="bg-indigo-500 self-end p-4 rounded-3xl text-[11px] text-white max-w-[85%] rounded-tr-none shadow-lg font-bold">
                          Yes, and name it DIM_ACCOUNT.
                        </motion.div>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="flex items-center gap-3">
                          <span className="flex gap-1.5">
                            <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, delay: 0 }} className="w-2 h-2 bg-indigo-400 rounded-full" />
                            <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, delay: 0.2 }} className="w-2 h-2 bg-indigo-400 rounded-full" />
                            <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, delay: 0.4 }} className="w-2 h-2 bg-indigo-400 rounded-full" />
                          </span>
                          <span className="text-[10px] text-indigo-500 font-mono font-black italic">GENERIC DDL UPDATING...</span>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ... generator ... */}
                {activeTab === 'etl_tsql_generator' && (
                  <motion.div key="generator" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.08)_0,transparent_60%)]"></div>
                    <div className="relative w-[400px] h-56 border-2 rounded-[40px] overflow-hidden shadow-2xl z-10 scale-110" style={{ background: 'var(--bg-void)', borderColor: 'var(--border-default)' }}>
                      <div className="absolute left-0 top-0 bottom-0 w-10 border-r flex flex-col items-center py-4 gap-1 text-[9px] font-mono font-black" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                        {Array.from({ length: 8 }).map((_, i) => <span key={i}>{i + 1}</span>)}
                      </div>
                      <div className="pl-14 pt-6 pr-6 font-mono text-[11px] space-y-1" style={{ color: 'var(--text-secondary)' }}>
                        <div><span className="text-pink-500">{'<step>'}</span></div>
                        <div className="pl-4"><span className="text-orange-500">{'<name>'}</span>TableInput<span className="text-orange-500">{'</name>'}</span></div>
                        <div className="pl-4"><span className="text-blue-500">{'<type>'}</span>Database<span className="text-blue-500">{'</type>'}</span></div>
                        <div className="pl-4"><span className="text-emerald-500">{'<sql>'}</span>SELECT * FROM dw.sales<span className="text-emerald-500">{'</sql>'}</span></div>
                        <div><span className="text-pink-500">{'</step>'}</span></div>
                      </div>
                      <motion.div animate={{ top: ['0%', '100%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }} className="absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent to-orange-400/5 pointer-events-none" />
                      <div className="absolute bottom-0 right-0 bg-orange-500 text-white text-[10px] font-black px-4 py-1 rounded-tl-2xl shadow-lg shadow-orange-500/20 uppercase tracking-widest italic">
                        PDI XML READY
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ... executor ... */}
                {activeTab === 'etl_executor' && (
                  <motion.div key="executor" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="w-full h-full flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.08)_0,transparent_60%)]"></div>
                    <div className="w-[450px] relative z-10 flex flex-col gap-5 scale-110">
                      {[
                        { step: 'Extract source data (API_SYNC)', delay: 0 },
                        { step: 'Join Surrogate Keys (DIM_LOAD)', delay: 0.8 },
                        { step: 'Batch Inserting Fact Table', delay: 1.6 }
                      ].map((item, index) => (
                        <motion.div key={index} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: item.delay }} className="border p-5 rounded-3xl flex items-center justify-between backdrop-blur-2xl" style={{ background: 'rgba(255,255,255,0.5)', borderColor: 'var(--border-subtle)' }}>
                          <span className="text-xs uppercase tracking-widest font-black italic" style={{ color: 'var(--text-primary)' }}>{item.step}</span>
                          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: item.delay + 0.4 }}>
                            <CheckCircle2 size={24} className="text-emerald-500" />
                          </motion.div>
                        </motion.div>
                      ))}
                      <div className="mt-4">
                        <div className="w-full h-3 rounded-full border overflow-hidden" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2.5, ease: 'linear', repeat: Infinity }} className="h-full bg-pink-500 rounded-full shadow-lg shadow-pink-500/20" />
                        </div>
                        <p className="text-center mt-3 text-[9px] font-mono text-pink-500 font-bold tracking-[0.2em] italic uppercase animate-pulse">Neural Pipeline Executing at 1.2M rows/sec</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-12 w-full max-w-4xl text-center">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="flex flex-col items-center">
                  <div className="flex items-center gap-5 mb-6">
                    <div className={`p-3 rounded-[24px] border transition-all duration-700 bg-white shadow-sm ${agents[activeTab].border} ${agents[activeTab].color}`}>
                      {React.createElement(agents[activeTab].icon, { size: 38 })}
                    </div>
                    <h3 className={`text-4xl md:text-5xl font-black italic tracking-tighter transition-colors ${agents[activeTab].color}`}>
                      {agents[activeTab].title}
                    </h3>
                  </div>
                  <p className="text-lg md:text-xl max-w-2xl leading-relaxed font-bold tracking-tight" style={{ color: 'var(--text-secondary)' }}>
                    {agents[activeTab].desc}
                  </p>
                  <div className="flex gap-3 mt-10">
                    {Object.keys(agents).map(key => (
                      <button key={key} onClick={() => setActiveTab(key)} className={`h-1.5 transition-all duration-500 rounded-full ${activeTab === key ? 'w-16 bg-indigo-500 shadow-lg shadow-indigo-500/30' : 'w-3 bg-slate-300 hover:bg-slate-400'}`} />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ENRICHIS ── */}
      <section className="relative z-10 w-full py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Ils nous font confiance</h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Des entreprises algeriennes et internationales accelerent leur transformation data avec Agent BI.
            </p>
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Karim B.', role: 'Chief Data Officer', company: 'Sonelgaz',
                text: 'Nous avons reduit le temps de conception de notre Data Warehouse de 3 mois a 3 jours. Les agents IA sont incroyablement precis et autonomes.',
                stars: 5, metric: '90% temps gagne', metricColor: '#34d399'
              },
              {
                name: 'Amina L.', role: 'Data Engineer', company: 'Djezzy',
                text: 'Le Critic Agent a detecte des erreurs de relation que notre equipe avait manquees. C est comme avoir un architecte data senior disponible 24/7.',
                stars: 5, metric: '47 bugs evites', metricColor: '#60a5fa'
              },
              {
                name: 'Youssef M.', role: 'BI Manager', company: 'Cevital',
                text: 'L integration avec Pentaho est transparente. Nous generons des flux ETL production-ready sans ecrire une seule ligne de code.',
                stars: 5, metric: 'ROI en 2 semaines', metricColor: '#fbbf24'
              }
            ].map((t, i) => (
              <motion.div key={i} variants={fadeInUp} className="rounded-3xl border p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <Quote size={20} className="text-indigo-300 mb-3" />
                <p className="text-sm leading-relaxed mb-6 font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>{t.text}</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.name}</div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t.role} · {t.company}</div>
                  </div>
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg w-fit" style={{ background: `${t.metricColor}12`, color: t.metricColor }}>
                  {t.metric}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── COMPARATIF CONCURRENTIEL ── */}
      <section className="relative z-10 w-full py-24 md:py-32 border-y" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Pourquoi Agent BI ?</h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>Comparez avec les solutions traditionnelles du marche.</p>
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="rounded-[28px] border overflow-hidden" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: 'var(--bg-base)' }}>
                    <th className="text-left px-6 py-4 font-bold text-white border-b" style={{ borderColor: 'var(--border-subtle)', minWidth: 200 }}>Critere</th>
                    <th className="text-center px-4 py-4 font-bold border-b" style={{ borderColor: 'var(--border-subtle)', color: '#3d6ae8', minWidth: 160 }}>Agent BI</th>
                    <th className="text-center px-4 py-4 font-bold border-b" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)', minWidth: 160 }}>Pentaho Manual</th>
                    <th className="text-center px-4 py-4 font-bold border-b" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)', minWidth: 160 }}>Talend / SSIS</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { crit: 'Temps de setup', agent: '7 min', others: ['3-6 mois', '2-4 mois'], agentHighlight: true },
                    { crit: 'Code requis', agent: 'Zero', others: ['10 000+ lignes', '5 000+ lignes'], agentHighlight: true },
                    { crit: 'IA autonome', agent: '9 agents', others: ['Non', 'Non'], agentHighlight: true },
                    { crit: 'Auto-healing', agent: 'Inclus', others: ['Manuel', 'Manuel'], agentHighlight: true },
                    { crit: 'Modelisation IA', agent: 'Automatique', others: ['Manuelle', 'Manuelle'], agentHighlight: true },
                    { crit: 'Cout annuel', agent: '12 000 DA', others: ['500K+ DA', '300K+ DA'], agentHighlight: true },
                    { crit: 'HITL Review', agent: 'Integre', others: ['Non', 'Non'], agentHighlight: true },
                    { crit: 'Drift Detection', agent: 'Temps reel', others: ['Non', 'Non'], agentHighlight: true },
                  ].map((row, i) => (
                    <motion.tr key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: i * 0.08 }} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5 font-medium text-white border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>{row.crit}</td>
                      <td className="text-center px-4 py-3.5 font-bold border-b" style={{ borderColor: 'rgba(255,255,255,0.04)', color: row.agentHighlight ? '#34d399' : 'var(--text-secondary)' }}>{row.agent}</td>
                      <td className="text-center px-4 py-3.5 border-b" style={{ color: 'var(--text-muted)', borderColor: 'rgba(255,255,255,0.04)' }}>{row.others[0]}</td>
                      <td className="text-center px-4 py-3.5 border-b" style={{ color: 'var(--text-muted)', borderColor: 'rgba(255,255,255,0.04)' }}>{row.others[1]}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="relative z-10 w-full py-24 md:py-32 border-y" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', scrollMarginTop: '100px' }}>
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-5" style={{ color: 'var(--text-primary)' }}>Choisissez le Plan Ideal</h2>
            <p className="text-lg max-w-2xl mx-auto mb-16 font-medium" style={{ color: 'var(--text-secondary)' }}>
              Debloquez la puissance de l IA pour votre Data Warehouse. Des tarifs clairs, adaptes au marche algerien, sans surprises.
            </p>
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto text-left">
            {/* Mensuel */}
            <motion.div variants={scaleIn} className="rounded-[32px] p-8 flex flex-col transition-all duration-500 hover:-translate-y-2 border hover:border-indigo-300" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Mensuel</h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-black" style={{ color: 'var(--text-primary)' }}>1 500 DA</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>/ utilisateur / mois</span>
              </div>
              <button className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] transition-transform mb-8 border" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>Essayer Gratuitement</button>
              <div className="space-y-4 text-sm font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Essai gratuit de 3 jours</div>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Acces illimite aux graphes IA</div>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Synchronisation de 5 sources max</div>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Support communautaire</div>
              </div>
              <div className="mt-8 text-[11px] font-medium border-t pt-4" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>Facture mois par mois. Annulation a tout moment.</div>
            </motion.div>

            {/* Annuel */}
            <motion.div variants={scaleIn} className="rounded-[32px] p-8 flex flex-col relative transform md:-translate-y-4 hover:-translate-y-6 transition-all duration-500 border-2 shadow-xl shadow-indigo-900/5" style={{ background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)', borderColor: 'rgba(61,106,232,0.25)' }}>
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-indigo-500/20">Populaire</div>
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Annuel</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-black" style={{ color: 'var(--text-primary)' }}>1 000 DA</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>/ utilisateur / mois</span>
              </div>
              <div className="text-indigo-600 text-[11px] font-black uppercase tracking-widest mb-4 bg-indigo-50 inline-block px-3 py-1 rounded-full w-fit border border-indigo-100">Economisez 33% !</div>
              <button onClick={onSelectSource} className="w-full py-4 rounded-xl text-white font-black uppercase tracking-widest text-sm hover:scale-[1.02] transition-transform mb-8 shadow-lg shadow-indigo-500/20" style={{ background: 'var(--grad-primary)' }}>Essayer Gratuitement</button>
              <div className="space-y-4 text-sm font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Essai gratuit de 3 jours</div>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Acces illimite aux graphes IA & Auto-Correction</div>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Sources de donnees illimitees</div>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Execution de flux ETL en temps reel</div>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Support prioritaire 24/7</div>
              </div>
              <div className="mt-8 text-[11px] font-medium border-t pt-4" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>Facture 12 000 DA par an apres la periode d essai.</div>
            </motion.div>

            {/* Equipe */}
            <motion.div variants={scaleIn} className="rounded-[32px] p-8 flex flex-col transition-all duration-500 hover:-translate-y-2 border hover:border-purple-300" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Equipe</h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-black" style={{ color: 'var(--text-primary)' }}>25 000 DA</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>/ par an</span>
              </div>
              <div className="w-full px-4 py-2 rounded-xl text-xs font-medium flex justify-between items-center mb-6 border" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}>
                Jusqu a 5 utilisateurs <ChevronRight size={14} />
              </div>
              <button className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] transition-transform mb-8 border" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>Nous Contacter</button>
              <div className="space-y-4 text-sm font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Toutes les fonctionnalites du plan Annuel</div>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Gestion granulaire des permissions</div>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Module HITL multi-collaborateurs</div>
                <div className="flex items-start gap-3"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Deploiement on-premise possible</div>
              </div>
              <div className="mt-8 text-[11px] font-medium border-t pt-4" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>Facture 25 000 DA par an. Aucun frais d installation cache.</div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative z-10 w-full py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5" style={{ color: 'var(--text-primary)' }}>Questions frequentes</h2>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>Tout ce que vous devez savoir avant de demarrer.</p>
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="flex flex-col gap-4">
            {faqs.map((faq, i) => (
              <motion.div key={i} variants={fadeInUp} className="rounded-2xl border overflow-hidden transition-all" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left">
                  <span className="font-bold text-sm md:text-base pr-4" style={{ color: 'var(--text-primary)' }}>{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={20} className="text-indigo-500 shrink-0" /> : <ChevronDown size={20} style={{ color: 'var(--text-muted)' }} className="shrink-0" />}
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-6 pb-6 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{faq.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="w-full py-24 md:py-32 border-t relative overflow-hidden flex flex-col items-center justify-center text-center" style={{ borderColor: 'var(--border-subtle)', background: 'linear-gradient(180deg, var(--bg-base) 0%, var(--bg-elevated) 100%)' }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(61,106,232,0.06)_0,transparent_60%)]"></div>
        <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative z-10 max-w-2xl px-6">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6 tracking-tight" style={{ color: 'var(--text-primary)' }}>Pret a automatiser vos donnees ?</h2>
          <p className="text-lg mb-10 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Rejoignez des milliers d ingenieurs qui construisent des fondations analytiques robustes avec l IA. Essai gratuit de 3 jours, sans engagement.</p>
          <button onClick={onSelectSource} className="px-8 py-4 text-white rounded-2xl font-semibold text-lg hover:scale-[1.02] transition-all flex items-center gap-3 group shadow-xl shadow-indigo-500/15" style={{ background: 'var(--grad-primary)' }}>
            Commencer Dès Maintenant
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="w-full border-t py-16 transition-colors duration-500" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo-hero.svg" alt="Agent BI" className="h-10 w-auto" />
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                La premiere plateforme algerienne de Data Warehouse autonome, propulsee par 9 agents IA specialises.
              </p>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <Globe size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <MessageSquare size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <Database size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Produit</h4>
              <div className="flex flex-col gap-3 text-sm font-medium">
                <button onClick={(e) => scrollToSection(e, 'platform')} className="text-left hover:text-indigo-600 transition-colors" style={{ color: 'var(--text-secondary)' }}>Plateforme IA</button>
                <button onClick={(e) => scrollToSection(e, 'howitworks')} className="text-left hover:text-indigo-600 transition-colors" style={{ color: 'var(--text-secondary)' }}>Comment ca marche</button>
                <button onClick={onUseCaseOpen} className="text-left hover:text-indigo-600 transition-colors" style={{ color: 'var(--text-secondary)' }}>Cas d usage</button>
                <button onClick={onDocsOpen} className="text-left hover:text-indigo-600 transition-colors" style={{ color: 'var(--text-secondary)' }}>Documentation</button>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Entreprise</h4>
              <div className="flex flex-col gap-3 text-sm font-medium">
                <span className="hover:text-indigo-600 transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}>A propos</span>
                <span className="hover:text-indigo-600 transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Carrieres</span>
                <span className="hover:text-indigo-600 transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Blog</span>
                <span className="hover:text-indigo-600 transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Contact</span>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Legal</h4>
              <div className="flex flex-col gap-3 text-sm font-medium">
                <span className="hover:text-indigo-600 transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Politique de Confidentialite</span>
                <span className="hover:text-indigo-600 transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Conditions d Utilisation</span>
                <span className="hover:text-indigo-600 transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Securite</span>
                <span className="hover:text-indigo-600 transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}>RGPD</span>
              </div>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}> 2026 Agent BI. Tous droits reserves.</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Fait avec precision en Algerie.</span>
          </div>
        </div>
      </footer>

      {/* ── Inline styles ── */}
      <DemoModal isOpen={showDemo} onClose={() => setShowDemo(false)} />

      <style dangerouslySetInnerHTML={{ __html: `
        .shadow-glow { box-shadow: 0 0 25px rgba(99,102,241,0.3); }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(61,106,232,0.15); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(61,106,232,0.3); }
      ` }} />
    </div>
  );
}
