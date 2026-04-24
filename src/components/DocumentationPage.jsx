import React, { useState } from 'react';
import { 
  Book, ChevronRight, Terminal, Database, Code, Shield, Network, 
  Zap, Play, Box, Star, ArrowRight, Bot, Search, FileText, Cpu, 
  Activity, Workflow, CheckCircle2, Cloud, HardDrive, LayoutGrid, ChevronLeft, Sparkles, User, Calendar, Clock, Lock, Settings, Server
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import ProcessDiagram from './ProcessDiagram';

const CodeBlock = ({ language, code }) => (
  <div className="my-10 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#0d0d12]">
    <div className="flex items-center px-5 py-3 bg-[#18181b] border-b border-white/5 shadow-sm">
      <div className="flex gap-2">
        <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
        <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
        <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
      </div>
      <span className="ml-5 text-[11px] font-black font-mono text-zinc-400 uppercase tracking-widest">{language}</span>
    </div>
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      customStyle={{ margin: 0, padding: '2rem', background: '#09090b', fontSize: '14px', lineHeight: '1.7', fontFamily: 'monospace' }}
      wrapLines={true}
    >
      {code}
    </SyntaxHighlighter>
  </div>
);

const Callout = ({ type, title, children }) => {
  const styles = {
    info: "bg-indigo-500/10 border-indigo-500/30 text-indigo-100",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-100",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-100",
    danger: "bg-rose-500/10 border-rose-500/30 text-rose-100"
  };
  return (
    <div className={`my-12 p-8 rounded-[24px] border-l-4 border-r border-t border-b ${styles[type]} flex gap-6 items-start backdrop-blur-md`}>
      <div className="mt-1 p-3 rounded-xl bg-white/10 shadow-sm shrink-0">
        {type === 'info' && <Book size={24} className="text-indigo-400" />}
        {type === 'warning' && <Zap size={24} className="text-amber-400" />}
        {type === 'success' && <Shield size={24} className="text-emerald-400" />}
        {type === 'danger' && <Lock size={24} className="text-rose-400" />}
      </div>
      <div>
        <h4 className="font-black text-lg mb-3 uppercase tracking-wide opacity-100">{title}</h4>
        <div className="text-[16px] opacity-90 leading-relaxed font-medium">{children}</div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="mb-20">
    <h2 className="text-3xl font-black text-white mb-8 border-l-[6px] border-indigo-500 pl-6 uppercase tracking-tight">{title}</h2>
    <div className="text-[17px] text-zinc-300 leading-[1.8] font-medium space-y-6">
      {children}
    </div>
  </div>
);

export default function DocumentationPage({ initialTab = 'intro' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const docs = [
    {
      id: 'intro',
      category: 'Concepts Fondamentaux',
      title: 'Philosophie & Architecture Agentique',
      icon: <Book size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[900px] text-zinc-300">
          
          <h1 className="text-5xl md:text-6xl font-black text-white mb-10 leading-[1.1] tracking-tight border-b border-white/10 pb-10">L'Ère de l'Ingénierie de Données Autonome</h1>
          
          <p className="text-xl text-zinc-400 mb-12 leading-relaxed font-medium">
             Au cours des dix dernières années, l'ingénierie de données a traversé plusieurs paradigmes technologiques : le traitement par lots monolithique, l'intégration basée sur les flux ETL, et enfin l'ELT soutenu par le cloud. Cependant, ces paradigmes compartimentent l'intelligence humaine. Avec AutoETL AI, nous introduisons la <strong>Génération Conceptuelle</strong>, un passage crucial de l'automatisation à l'autonomie.
          </p>

          <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=2070&q=80" alt="Data Dashboard" className="w-full h-[400px] object-cover rounded-[32px] mb-16 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10" />
          
          <Section title="1. Les Limites de l'ETL Traditionnel">
            <p>Historiquement, l'extraction, la transformation et le chargement de données (ETL) ont imposé un goulot d'étranglement majeur. Chaque nouvelle source de données nécessitait la rédaction manuelle de scripts (Python, SQL, XML), le mappage rigoureux des colonnes, et une maintenance chronophage. Des outils comme Talend, Informatica ou même dbt, bien qu'excellents, dépendent d'une infrastructure déclarative statique.</p>
            <p>Lorsqu'une colonne est ajoutée dans une base de données opérationnelle (PostgreSQL ou MongoDB), le pipeline entier échoue ou ignore l'information ("Data Drift"). L'équipe Data doit alors intervenir pour mettre à jour les requêtes, recompiler les DAGs Airflow, et relancer les flux. Ce modèle n'est plus scalable dans un environnement où les données évoluent chaque semaine.</p>
            
            <Callout type="warning" title="La Dette Technique des Pipelines">
              Les études démontrent que 60% du temps des ingénieurs de données est consacré à la maintenance des pipelines cassés (modification de schémas, types de données changeants, clés nulles). AutoETL AI a été conçu pour inverser cette statistique.
            </Callout>
          </Section>

          <Section title="2. Intelligence Artificielle Multi-Agents">
            <p>Le cœur d'AutoETL AI n'est pas un orchestrateur de tâches, mais un graphe cognitif propulsé par LangGraph. Pour pallier les limites des Large Language Models (LLM) comme Google Gemini ou OpenAI (hallucinations, manque de contexte), nous avons divisé l'architecture en 9 entités distinctes, chacune experte dans son domaine :</p>
            <ul className="list-disc pl-8 space-y-4 mb-8">
              <li><strong className="text-white">Agent Explorateur :</strong> Se connecte par JDBC ou API aux sources, scanne de manière heuristique les relations entre les tables pour reconstruire un Entité-Relation (ERD) virtuel.</li>
              <li><strong className="text-white">Agent Modélisateur :</strong> Applique les principes de modélisation dimensionnelle (Ralph Kimball). Il détecte les "Faits" (mesures) et les "Dimensions" (attributs) et génère la structure sous-jacente.</li>
              <li><strong className="text-white">Agent Critique :</strong> Le gardien du temple. Il doute de tout, vérifie les contraintes d'intégrité (Primary Keys, Foreign Keys), et bloque les tables anormalement isolées.</li>
            </ul>
            <p>Ces agents communiquent via un objet d'État (State) partagé, s'envoyant des "prompt-messages" internes jusqu'à aboutir à une architecture de Data Warehouse infaillible.</p>
          </Section>

          <img src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=2070&q=80" alt="Tech Architecture" className="w-full h-[400px] object-cover rounded-[32px] mb-16 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10" />

          <Section title="3. L'Auto-Guérison (Self-Healing)">
            <p>L'un des éléments les plus révolutionnaires de l'architecture est le nud "Healer". Lorsqu'un pipeline ETL s'exécute, il arrive inévitablement qu'une anomalie métier survienne. Un type String est envoyé dans une colonne Integer, ou la taille dépasse VARCHAR(255).</p>
            <p>Là où un système classique crasherait et alerterait l'ingénieur de garde à 3h du matin, AutoETL AI intercepte le <code>Stack Trace</code> de l'erreur SQL. Il la transmet au LLM avec le contexte du DDL de la table. L'intelligence artificielle comprend l'erreur, génère la commande <code>ALTER TABLE</code> nécessaire pour corriger la cible, et relance l'étape !</p>
          </Section>
        </div>
      )
    },
    {
      id: 'quickstart',
      category: 'Déploiement',
      title: 'Installation On-Premise & Cloud (V3.0)',
      icon: <Server size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[900px] text-zinc-300">
          <h1 className="text-5xl md:text-6xl font-black text-white mb-10 leading-[1.1] tracking-tight border-b border-white/10 pb-10">Guide de Déploiement Haute Disponibilité</h1>
          <p className="text-xl text-zinc-400 mb-12 leading-relaxed font-medium">
            L'architecture de AutoETL AI respecte les standards DevOps modernes. Elle est conteneurisée, sans état (stateless) au niveau du moteur LLM, et scale horizontalement. Ce guide détaille l'installation allant du simple développement local au cluster Kubernetes de production.
          </p>

          <Section title="1. Environnement Local Complet (Docker Compose)">
            <p>Pour l'évaluation technique et le PoC, Docker Compose est la solution la plus rapide. Ce déploiement installe l'API FastAPI, l'interface React, mais également un Data Warehouse de test (PostgreSQL 15) et Redis pour la gestion des files d'attente Pub/Sub.</p>
            <p>Commencez par cloner le dépôt et créer votre fichier d'environnement global :</p>
            
            <CodeBlock language="bash" code={`git clone https://github.com/votre-org/autoetl-ai.git\ncd autoetl-ai\n\n# Configuration de base\ncp .env.example .env`} />
            
            <p>Modifiez le <code>.env</code> pour y inclure vos paramètres cruciaux. Le moteur est agnostique au LLM utilisé, mais a été optimisé pour Google Gemini 1.5 Flash et Pro.</p>
            
            <CodeBlock language="env" code={`# ---- LLM Configuration ----\nGEMINI_API_KEY=votre_cle_gemini\nMODEL_TEMPERATURE=0.1 # Maintenir bas pour la régularité du code généré\n\n# ---- Database Targets ----\nTARGET_DW_PROTOCOL=postgresql+psycopg2\nTARGET_DW_USER=admin\nTARGET_DW_PASSWORD=SecurePassword123!\nTARGET_DW_HOST=db-warehouse\nTARGET_DW_PORT=5432\nTARGET_DW_NAME=analytics_db`} />

            <Callout type="success" title="Démarrage du Cluster local">
              Exécutez <code>docker-compose up -d --build</code>. L'interface d'administration sera immédiatement joignable sur <strong>http://localhost:5173</strong>.
            </Callout>
          </Section>

          <Section title="2. Configuration Bare-Metal (Sans Docker)">
            <p>Dans un environnement sécurisé interdisant l'utilisation de Docker, il convient de déployer les microservices de façon granulaire. Python 3.10+ et Node.js 18+ sont des pré-requis stricts.</p>
            <CodeBlock language="bash" code={`# Étape 1 : Le Cerveau Backend (FastAPI)\ncd backend\npython3 -m venv venv\nsource venv/bin/activate\npip install -r requirements.txt\n\n# Lancer les workers Uvicorn\nuvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4\n\n# Étape 2 : Le Tableau de Bord (React/Vite)\ncd ../frontend\nnpm ci\nnpm run build\nnpm run preview -- --port 5173 --host`} />
            <p>Le flag <code>--workers 4</code> permet de gérer les processus asynchrones intensifs (comme l'extraction distante ou le prompt-engineering I/O-bound) de manière fluide.</p>
          </Section>

          <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=2034&q=80" alt="Servers" className="w-full h-[400px] object-cover rounded-[32px] mb-16 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10" />

          <Section title="3. Déploiement Cloud Native (Kubernetes)">
            <p>Pour les grandes entreprises nécessitant le traitement de Téraoctets de données journalières et le support d'une équipe de 50+ ingénieurs, le déploiement K8s est recommandé. Les chartes Helm d'AutoETL orchestrent les ReplicaSets et intègrent l'Ingress Nginx.</p>
            <CodeBlock language="yaml" code={`# values.yaml (Extrait Helm)\nfrontend:\n  replicaCount: 3\n  resources:\n    limits:\n      cpu: "1"\n      memory: "2Gi"\n\nbackend:\n  replicaCount: 5\n  autoscaling:\n    enabled: true\n    minReplicas: 3\n    maxReplicas: 15\n    targetCPUUtilizationPercentage: 80`} />
            <p>Dans cette architecture, les logs d'exécution des agents <code>ETL Executor</code> sont collectés via Fluentd et sont retransmis dynamiquement à l'interface via les WebSockets ou Server-Sent Events (SSE) gérés par Redis.</p>
          </Section>
        </div>
      )
    },
    {
      id: 'architecture_state',
      category: 'Développement Interne',
      title: 'Machine à États LangGraph (Deep Dive)',
      icon: <Network size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[900px] text-zinc-300">
          <h1 className="text-5xl md:text-6xl font-black text-white mb-10 leading-[1.1] tracking-tight border-b border-white/10 pb-10">La Morphologie du Graphe Cognitif</h1>
          <p className="text-xl text-zinc-400 mb-12 leading-relaxed font-medium">
            Toute la logique d'AutoETL AI est sous-tendue par LangGraph. Pour comprendre comment interagir avec le code source de l'application, il est essentiel de comprendre comment fonctionne la gestion du graph de l'état asynchrone (StateGraph).
          </p>

          <Section title="La Structure TypedDict">
            <p>L'état est l'objet unique qui transite d'un nud (Agent) à l'autre. Il garantit la traçabilité. Chaque modification par un agent remplace ou ajoute une valeur à ce dictionnaire.</p>
            <CodeBlock language="python" code={`from typing_extensions import TypedDict\nfrom typing import Any, Dict, List, Optional\n\nclass AgentState(TypedDict):\n    session_id: str                   # Identifiant unique de la transaction\n    connection_config: Dict[str, Any] # Configuration de la DB source\n    metadata: str                     # Résultat massif du scan de schéma\n    sql_ddl: str                      # Script DDL du schéma étoile/flocon\n    critic_review: str                # Analyse de sécurité, PK/FK\n    is_validated: bool                # L'humain a-t-il approuvé ? (HITL)\n    etl_code: str                     # Le code XML ou Python généré\n    pdi_output: str                   # Logs de l'exécution ETL réelle\n    retry_count: int                  # Compteur pour l'auto-healer`} />
          </Section>

          <Section title="Câblage des Agents (Nodes & Edges)">
            <p>La puissance du système vient des <code>Conditional Edges</code> (Arêtes conditionnelles). Ils permettent au réseau de prendre des décisions basées sur l'état. Par exemple, si l'agent Critique juge le code DDL invalide, la condition renvoie l'état au Modélisateur, réalisant ainsi une boucle de raisonnement robuste (Looping).</p>
            
            <CodeBlock language="python" code={`from langgraph.graph import StateGraph, END\n\n# Initialisation du Graphe\nworkflow = StateGraph(AgentState)\n\n# Ajout des Neuromodules (Nœuds)\nworkflow.add_node("explorer", explorer_agent)\nworkflow.add_node("modeler", modeler_agent)\nworkflow.add_node("critic", critic_agent)\nworkflow.add_node("human_review", human_intervention_node)\nworkflow.add_node("etl_generator", generator_agent)\nworkflow.add_node("healer", healer_agent)\n\n# Modélisation Séquentielle\nworkflow.set_entry_point("explorer")\nworkflow.add_edge("explorer", "modeler")\nworkflow.add_edge("modeler", "critic")\n\n# Edge Conditionnelle (La magie de l'audit)\nworkflow.add_conditional_edges(\n    "critic",\n    check_critic_approval,\n    {\n        "approved": "human_review",\n        "rejected": "modeler" # Renvoi au concepteur pour correction\n    }\n)`} />
            <Callout type="info" title="L'importance de la condition 'rejected'">
              L'AutoETL n'entraîne pas un apprentissage direct des poids du modèle. C'est l'In-Context Learning : l'agent Modélisateur reçoit les arguments critiques de l'agent Critique dans le nouvel état et comprend qu'il a oublié de créer une table de dimension Temps. Il corrige alors son tir. Ainsi, les performances en Zero-Shot du LLM sont immensément améliorées.
            </Callout>
          </Section>

          <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2072&q=80" alt="Neural Networking" className="w-full h-[400px] object-cover rounded-[32px] mb-16 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10" />

          <Section title="Le Processus Human-in-the-Loop (HITL)">
            <p>La confiance n'exclut pas le contrôle. Au nud <code>human_review</code>, l'exécution s'interrompt purement et simplement. Le thread backend libère la mémoire, mais sauvegarde l'état dans la base de données. L'interface utilisateur affiche alors le plan ("Dry Run") à l'ingénieur de données (DDL, tables affectées).</p>
            <p>Une fois l'humain cliquant sur "Approuver", une requête est envoyée à FastAPI pour réveiller le graphe et poursuivre l'exécution vers <code>etl_tsql_generator</code>.</p>
          </Section>
        </div>
      )
    },
    {
      id: 'modeling',
      category: 'Ingénierie Structurale',
      title: 'Modèle Dimensionnel & Data Vault 2.0',
      icon: <Database size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[900px] text-zinc-300">
          <h1 className="text-5xl md:text-6xl font-black text-white mb-10 leading-[1.1] tracking-tight border-b border-white/10 pb-10">Algorithmes de Modélisation (AI)</h1>
          <p className="text-xl text-zinc-400 mb-12 leading-relaxed font-medium">
             Dans ce chapitre, nous expliquons comment le Modèle d'IA de la plateforme structure intellectuellement vos données brutes pour les transformer en Data Warehouse performant de type OLAP.
          </p>

          <Section title="Compréhension Sémantique des Schémas (Explorer)">
            <p>Lorsque AutoETL scanne vos bases distantes (MySQL, Salesforce, MongoDB via drivers JDBC/ODBC), l'agent n'extrait que des métadonnées (Metadata) par souci de sécurité des données personnelles (PII). Le Prompt de l'Agent prend cette forme :</p>
            <CodeBlock language="sql" code={`-- Ce que l'AI voit pour comprendre votre base\nSELECT table_name, column_name, data_type, character_maximum_length\nFROM information_schema.columns\nWHERE table_schema = 'public';`} />
            <p>Mais au-delà du typage, le modèle devine les relations cachées. Même s'il n'y a pas de clés étrangères (Foreign Keys constraint) définies dans la base source (très courant dans le Legacy), le modèle LLM fait du "Pattern Matching" : il associe <code>customer_id</code> et <code>id_client</code>, analysant la nomenclature de l'entreprise.</p>
          </Section>

          <Section title="Génération du Schéma Étoile (Star Schema)">
            <p>L'agent Modélisateur est prompté de manière agressive pour suivre la méthodologie de Ralph Kimball. Dès lors, il classe le métier analysé en événements et contextes :</p>
            <ul className="list-disc pl-8 space-y-4 mb-8">
              <li><strong>Table de Fait (Fact Table) :</strong> Les transactions, les ventes, les clics. Contient avant tout des Surrogate Keys (clés de substitution techniques), et des métriques chiffrées (montant, volume, durée).</li>
              <li><strong>Tables de Dimensions :</strong> Les axes d'analyse. Un client, un produit, un magasin. AutoETL AI applique le principe de Dénormalisation pour optimiser les performances de lecture côté Dashboard (Tableau, PowerBI).</li>
            </ul>
            <p>Par exemple, au lieu d'avoir un tableau Pays, un tableau Région, et un tableau Ville. Il compressera le tout dans une seule <code>DIM_LOCATION</code> très large.</p>
            <CodeBlock language="sql" code={`-- Exemple de génération complexe du Modélisateur\nCREATE TABLE FACT_SALES (\n    sk_sales_id SERIAL PRIMARY KEY,\n    sk_product_id INT NOT NULL REFERENCES DIM_PRODUCT(sk_product_id),\n    sk_customer_id INT NOT NULL REFERENCES DIM_CUSTOMER(sk_customer_id),\n    sk_date_id INT NOT NULL REFERENCES DIM_DATE(sk_date_id),\n    bk_transaction_id VARCHAR(100), -- Business Key pour traçabilité\n    revenue DECIMAL(15, 2),\n    sold_quantity INT\n);\n\nCREATE INDEX idx_fact_date ON FACT_SALES(sk_date_id);`} />
            
            <Callout type="warning" title="Dimensions Lentement Changeantes (SCD)">
              L'IA implémente dynamiquement la logique <strong>SCD Type 2</strong> (Slowly Changing Dimension). C'est pourquoi chaque table de dimension générée contiendra automatiquement des colonnes <code>valid_from</code>, <code>valid_to</code>, et <code>is_current</code>. Ainsi l'historisation de vos données est native.
            </Callout>
          </Section>

          <Section title="Approche Data Vault 2.0 In-Progress">
            <p>AutoETL est en train d'intégrer une bascule pour modéliser selon l'approche Data Vault de Dan Linstedt (Hubs, Links, Satellites). Cela sera particulièrement utile pour les consortiums d'entreprises où plus de 10 ERP se croisent et où le schéma Étoile devient trop instable à cause du Big Data massif.</p>
          </Section>
        </div>
      )
    },
    {
      id: 'drift',
      category: 'Maintenance & Résilience',
      title: 'Drift Detection & Healer Agent',
      icon: <Activity size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[900px] text-zinc-300">
          <h1 className="text-5xl md:text-6xl font-black text-white mb-10 leading-[1.1] tracking-tight border-b border-white/10 pb-10">La Résilience Autonome</h1>
          <p className="text-xl text-zinc-400 mb-12 leading-relaxed font-medium">
             Dans ce chapitre, découvrez pourquoi les flux de données créés par la plateforme peuvent tourner sans maintenance pendant des années. Les agents "Drift Detector" et "Healer" scannent perpétuellement l'intégrité de la structure et du code.
          </p>

          <Section title="Comprendre le Data Drift (Dérive de Schéma)">
            <p>La hantise des Data Engineers est le message Slack matinal : "Le dashboard CRM est à jour ?". Le Data Drift survient quand l'équipe Backend décide de modifier la base de données de production : renommer une colonne (<code>telephone_number</code> vers <code>phone</code>), supprimer une table, ou changer un Integer en Float.</p>
            <p>Comment l'agent réagit-il ? L'agent Explorateur est relancé automatiquement via un <strong>Service Cron</strong> (par défaut chaque nuit). Il génère un checksum du schéma. S'il détecte un différentiel (diff), il déclenche un événement <code>DRIFT_ALERT</code>.</p>
            
            <Callout type="danger" title="Resolution de Conflit Aléatoire">
              Plutôt que d'abandonner l'ETL, le Drift Detector notifie le Modélisateur des changements. Le Modélisateur génère un correctif DDL (<code>ALTER TABLE</code>) pour le Warehouse, et transmet les nouvelles règles de mapping à l'ETL Generator qui produira le nouveau XML Pentaho. Tout cela en une milliseconde.
            </Callout>
          </Section>
          
          <img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=2070&q=80" alt="Cyber Code Security" className="w-full h-[400px] object-cover rounded-[32px] mb-16 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10" />

          <Section title="Le Healer Agent (Auto-Corrections)">
            <p>Il arrive que l'ETL Executor échoue lors de la requête en base à cause de conflits SQL, données dupliquées (Primary Key Violation) ou syntaxes erronées (Dialecte incompatibles entre PostgreSQL et le DDL SQL Server généré).</p>
            <CodeBlock language="json" code={`{\n  "error_module": "ETL_EXECUTOR",\n  "database_type": "mysql",\n  "traceback": "pymysql.err.OperationalError: (1054, \\"Unknown column 'revenue' in 'field list'\\")",\n  "action": "Sending payload to HEALER_NODE"\n}`} />
            <p>Le Healer Agent recoit ce payload d'erreur. Puisque l'IA est multimodale dans son raisonnement, elle lit l'erreur "Unknown column", inspecte la mémoire du contexte DDL, identifie que la colonne a été nommée <code>total_revenue</code> par le modélisateur, et corrige la ligne de script ETL fautive de manière autonome.</p>
            <p>Cette boucle <code>Exécution -&gt; Panne -&gt; Diagnostic -&gt; Modification de code -&gt; Ré-exécution</code> s'opère dans la structure LangGraph (loop). La limite de boucles par défaut est fixée à 3 coups, avant de requérir une véritable intervention humaine (Fail-safe).</p>
          </Section>
        </div>
      )
    },
    {
      id: 'api_reference',
      category: 'Développement API',
      title: 'API Reference v3.0 (Endpoints)',
      icon: <Terminal size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[900px] text-zinc-300">
          <h1 className="text-5xl md:text-6xl font-black text-white mb-10 leading-[1.1] tracking-tight border-b border-white/10 pb-10">Interface API & Intégration</h1>
          <p className="text-xl text-zinc-400 mb-12 leading-relaxed font-medium">
             Toute la plateforme est "API-First". Même le tableau de bord React ne fait que communiquer avec le backend FastAPI. Vous pouvez donc intégrer la capacité de génération de notre IA dans vos propres logiciels internes en appelant simplement ces endpoints HTTP RESTful.
          </p>

          <Section title="Authentication">
            <p>Nous utilisons des JWT (JSON Web Tokens) sécurisés au niveau de l'URL et des Headers. Authentifiez-vous pour ouvrir une session de pipeline.</p>
            <CodeBlock language="bash" code={`curl -X POST https://api.autoetl.tech/api/v3/auth/token \\\n  -H "Content-Type: application/json" \\\n  -d '{"client_id": "YOUR_ID", "client_secret": "YOUR_KEY"}'`} />
            <p className="text-sm font-mono mt-4 text-emerald-400">Response : 200 OK — {"{"} "access_token": "eyJhbG..", "type": "bearer" {"}"}</p>
          </Section>

          <Section title="Lancer une Ingénierie Complète">
            <p>Le point d'entrée principal. Il démarre un thread d'agents LangGraph en arrière-plan. Fournissez vos paramètres de connexion source (la base opérationnelle).</p>
            <CodeBlock language="http" code={`POST /api/pipeline/start HTTP/1.1\nAuthorization: Bearer <TOKEN>\nContent-Type: application/json\n\n{\n    "source_type": "mysql",\n    "source_uri": "mysql+mysqlconnector://user:pass@10.0.0.1:3306/crm",\n    "target_dw_type": "postgres",\n    "focus_tables": ["users", "orders", "payments"],\n    "human_review_required": true\n}`} />
            <Callout type="info" title="Asynchrone">
              Cette route répond quasi-immédiatement avec un <code>job_id</code>. Le traitement cognitif d'architecture prend de 3 à 5 minutes selon la taille de l'ERP connecté.
            </Callout>
          </Section>

          <Section title="Stream des Evénements (Server-Sent Events)">
            <p>C'est l'endpoint le plus fascinant. Connectez-vous ici par programmation (EventSource en Javascript) pour "écouter" ou "regarder" les agents discuter, modéliser, et corriger le code en temps réel !</p>
            <CodeBlock language="javascript" code={`const eventSource = new EventSource('/api/pipeline/stream/<job_id>');\n\neventSource.onmessage = (event) => {\n    const agentMessage = JSON.parse(event.data);\n    console.log(\`Agent \${agentMessage.agent_name} dit : \${agentMessage.text}\`);\n    if (agentMessage.is_done) {\n        console.log("Le Warehouse est construit !");\n    }\n};`} />
            <p>Ce protocole est beaucoup plus léger que le WebSocket pour un suivi de logs unilatéral.</p>
          </Section>
        </div>
      )
    }
  ];

  const activeDocContent = docs.find(d => d.id === activeTab)?.content;

  const categories = {};
  docs.forEach(d => {
    if(!categories[d.category]) categories[d.category] = [];
    categories[d.category].push(d);
  });

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-[#09090b] text-white selection:bg-indigo-500/30 overflow-hidden">
      
      {/* Sidebar Navigation */}
      <div className="w-full lg:w-[350px] lg:h-full border-r border-white/5 bg-[#0d0d12] flex flex-col pt-8 overflow-y-auto custom-scrollbar shrink-0 relative z-20 shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="pl-10 mb-8 border-b border-white/5 pb-6 mr-10 relative">
           <div className="flex items-center gap-3 text-indigo-500 mb-2">
              <Book size={20} />
              <h2 className="text-xs font-black uppercase tracking-[0.2em]">Documentation</h2>
           </div>
           <h3 className="text-3xl font-black text-white tracking-tight">Platform Docs.</h3>
        </div>

        <div className="flex-1 px-6">
          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat} className="mb-8">
              <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest pl-4 mb-4">{cat}</h4>
              <div className="flex flex-col gap-1">
                {items.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => setActiveTab(doc.id)}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl text-[14px] font-semibold text-left transition-all duration-200 group ${
                      activeTab === doc.id 
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    <span className="mt-0.5 opacity-70 group-hover:scale-110 transition-transform">
                      {doc.icon}
                    </span>
                    <span className="leading-snug">{doc.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-auto p-6 border-t border-white/5 bg-black/20">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-900/50 to-purple-900/20 border border-white/10 p-6 relative overflow-hidden group text-center">
            <h4 className="font-black text-white text-[15px] mb-2 leading-tight">Mise à l'échelle</h4>
            <p className="text-[12px] text-zinc-400 mb-4 font-medium">AutoETL scale instantanément selon vos sources.</p>
            <button className="w-full bg-white text-black font-black text-xs py-3 rounded-xl hover:bg-zinc-200 transition-colors uppercase tracking-widest shadow-lg">Start Free Trial</button>
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 h-full overflow-y-auto custom-scrollbar scroll-smooth relative bg-[#09090b]">
         
         {/* Subtle background effects for immense depth */}
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none"></div>
         <div className="absolute bottom-[20%] right-[-10%] w-[30%] h-[50%] bg-cyan-600/5 rounded-full blur-[180px] pointer-events-none"></div>
         
         {/* Top gradient bar */}
         <div className="sticky top-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 z-50 opacity-80"></div>
         
         {/* Close button simulator for user to go back to App/Landing, just generic UX */}
         <div className="absolute right-10 top-10 flex gap-4 z-40">
            <button className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest transition-all backdrop-blur-md">
               ← Retour
            </button>
         </div>

         <div className="max-w-[70rem] mx-auto px-8 lg:px-24 pt-24 pb-32 relative z-10 min-h-[90vh]">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, scale: 0.98, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.98, y: -10 }}
               transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
             >
               {activeDocContent}
             </motion.div>
           </AnimatePresence>
         </div>

         {/* Navigation Footer */}
         <div className="w-full bg-[#050505] border-t border-white/5 py-10 relative z-10">
            <div className="max-w-[70rem] mx-auto px-8 lg:px-24 flex flex-col md:flex-row justify-between items-center text-zinc-600 font-bold text-xs uppercase tracking-widest">
               <span>© 2026 AutoETL AI. Technologies neurales propulsées par Generative AI.</span>
               <div className="flex gap-8 mt-4 md:mt-0">
                  <span className="hover:text-indigo-400 cursor-pointer transition-colors">Privacy Policy</span>
                  <span className="hover:text-indigo-400 cursor-pointer transition-colors">Terms of Service</span>
                  <span className="hover:text-indigo-400 cursor-pointer transition-colors">Contact Support</span>
               </div>
            </div>
         </div>
         
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 20px; border: 2px solid transparent; background-clip: padding-box; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); border-radius: 20px; border: 2px solid transparent; background-clip: padding-box; }
      `}} />
    </div>
  );
}
