"""
test_composio.py — Validation de l'intégration Composio + CrewAI
Utilise le modèle Ollama local (qwen2.5-coder:7b) par défaut, comme l'application principale.

Usage (avec le .venv activé):
    .venv\\Scripts\\python.exe test_composio.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()


def check_prerequisites():
    """Vérifie que les modules essentiels sont là."""
    print("=== Vérification des prérequis ===")
    for mod, pkg in [("crewai", "crewai"), ("composio", "composio"), ("composio_crewai", "composio-crewai")]:
        try:
            __import__(mod)
            print(f"  ✅ {pkg}")
        except ImportError:
            print(f"  ❌ {pkg} — MANQUANT (pip install {pkg})")
            return False

    api_key = os.environ.get("COMPOSIO_API_KEY", "").strip()
    if not api_key:
        print("  ❌ COMPOSIO_API_KEY non définie dans .env !")
        return False
    print(f"  ✅ COMPOSIO_API_KEY définie ({api_key[:8]}...)")
    return True


def run_crewai_agent():
    """Lance un agent CrewAI avec Ollama (consistent avec llm_factory)."""
    from crewai import Agent, Task, Crew, Process, LLM
    from composio import Composio
    from composio_crewai import CrewAIProvider

    print("\n=== Démarrage du test autonome Composio + CrewAI + Ollama ===\n")
    composio_api_key = os.environ.get("COMPOSIO_API_KEY", "").strip()
    
    # Récupérer les paramètres Ollama depuis .env (comme dans nodes/llm_factory.py)
    ollama_base = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:7b")

    print(f"1. Configuration du LLM (Ollama: {ollama_model})...")
    local_llm = LLM(
        model=f"ollama/{ollama_model}",
        base_url=ollama_base,
        # Ollama local n'a pas besoin de clé API
    )
    print(f"   ✅ Connecté à {ollama_base}")

    print("2. Connexion à Composio...")
    tools = []
    try:
        client = Composio(api_key=composio_api_key)
        provider = CrewAIProvider(client=client)
        raw_tools = client.tools.get(user_id="default", toolkits=["FILETOOL"])
        if raw_tools:
            tools = provider.wrap_tools(raw_tools)
            print(f"   ✅ {len(tools)} outils FILETOOL chargés")
        else:
            print("   ⚠️  FILETOOL non activé ou non trouvé.")
    except Exception as e:
        print(f"   ⚠️  Composio : {e}")

    print("3. Création de l'Architect Agent...")
    architect_agent = Agent(
        role="Architecte Logiciel Senior",
        goal="Générer un résumé clair de l'architecture du projet Agent Data Warehouse v3.",
        backstory=(
            "Tu es un architecte logiciel expérimenté spécialisé dans les architectures "
            "multi-agents LangGraph et les pipelines ETL automatisés."
        ),
        verbose=True,
        llm=local_llm,
        tools=tools,
        allow_delegation=False,
    )

    print("4. Définition de la tâche...")
    analyze_task = Task(
        description=(
            "Rédige un rapport architecturel concis de 3 paragraphes sur ce projet. "
            "Le projet utilise FastAPI, MySQL (métadonnées) et une orchestration "
            "LangGraph avec 9 agents spécialisés (Explorer, Critic, Modeler, etc.)."
        ),
        expected_output="Un rapport architecturel de 3 paragraphes.",
        agent=architect_agent,
    )

    crew = Crew(
        agents=[architect_agent],
        tasks=[analyze_task],
        process=Process.sequential,
    )

    print("5. Lancement de l'agent...\n" + "─" * 60)
    try:
        result = crew.kickoff()
        print("\n" + "=" * 60)
        print("RAPPORT — Agent Data Warehouse v3")
        print("=" * 60)
        print(result)
        print("=" * 60 + "\n")
        print("✅ Test terminé !")
    except Exception as e:
        print(f"\n❌ Erreur : {e}")
        sys.exit(1)


if __name__ == "__main__":
    if check_prerequisites():
        run_crewai_agent()
    else:
        sys.exit(1)
