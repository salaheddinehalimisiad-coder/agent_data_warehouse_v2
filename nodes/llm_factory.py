# nodes/llm_factory.py — Factory LLM CORRIGÉ v2.1
"""
CORRECTIONS :
1. Timeout court (3s) pour tester Ollama — évite un blocage de 30s au démarrage
2. Message d'erreur clair si aucun LLM disponible
3. call_with_retry gère les erreurs réseau + quota + timeout
4. extract_text gère tous les types de réponse LangChain
"""
import os
import time
import logging
from typing import Any

logger = logging.getLogger(__name__)


def get_llm(temperature: float = 0.1) -> Any:
    """
    Sélectionne automatiquement le meilleur LLM disponible :
    1. Modèle Cloud via Ollama (OLLAMA_CLOUD_MODEL)
    2. Modèle local Ollama (OLLAMA_MODEL)
    3. Google Gemini API (GOOGLE_API_KEY)
    """
    ollama_base = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    # ── Priorité 1 : Cloud via Ollama ─────────────────────────────────────────
    cloud_model = os.getenv("OLLAMA_CLOUD_MODEL", "")
    ollama_key  = os.getenv("OLLAMA_API_KEY", "")
    if cloud_model and ollama_key and _check_ollama(ollama_base):
        try:
            from langchain_ollama import ChatOllama
            llm = ChatOllama(
                model=cloud_model,
                base_url=ollama_base,
                temperature=temperature,
                headers={"Authorization": f"Bearer {ollama_key}"},
            )
            logger.info(f"[LLM] Cloud Ollama : {cloud_model}")
            return llm
        except Exception as e:
            logger.warning(f"[LLM] Cloud Ollama indisponible : {e}")

    # ── Priorité 2 : Ollama local ─────────────────────────────────────────────
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
    if _check_ollama(ollama_base):
        try:
            from langchain_ollama import ChatOllama
            llm = ChatOllama(
                model=ollama_model,
                base_url=ollama_base,
                temperature=temperature,
            )
            logger.info(f"[LLM] Ollama local : {ollama_model}")
            return llm
        except Exception as e:
            logger.warning(f"[LLM] Ollama local erreur : {e}")

    # ── Priorité 3 : Google Gemini (fallback) ─────────────────────────────────
    google_key = os.getenv("GOOGLE_API_KEY", "")
    if google_key and google_key != "votre_cle_gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(
                model="models/gemini-1.5-flash",
                google_api_key=google_key,
                temperature=temperature,
                convert_system_message_to_human=True,
            )
            logger.info("[LLM] Google Gemini (fallback)")
            return llm
        except Exception as e:
            logger.warning(f"[LLM] Gemini erreur : {e}")

    # ── Aucun LLM disponible ──────────────────────────────────────────────────
    raise RuntimeError(
        "❌ Aucun LLM disponible.\n"
        "Vérifiez que :\n"
        "  1. Ollama est lancé : ollama serve\n"
        f"  2. Le modèle est installé : ollama pull {ollama_model}\n"
        "  3. Ou que GOOGLE_API_KEY est défini dans .env"
    )


def _check_ollama(base_url: str, timeout: int = 3) -> bool:
    """Vérifie qu'Ollama répond en moins de 3 secondes."""
    try:
        import requests
        r = requests.get(base_url, timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False


def call_with_retry(chain: Any, inputs: dict, max_retries: int = 3) -> Any:
    """
    Appel LLM avec backoff exponentiel.
    Gère : quota 429, timeout réseau, erreurs transitoires.
    """
    delay = 5
    last_error = None

    for attempt in range(max_retries):
        try:
            return chain.invoke(inputs)
        except Exception as e:
            last_error = e
            err_str = str(e).lower()

            # Quota / rate limit
            if "429" in err_str or "quota" in err_str or "rate" in err_str or "resource_exhausted" in err_str:
                wait = min(delay * (attempt + 1), 30)  # max 30s (WARN #5: cap to avoid blocking event loop)
                logger.warning(f"[LLM] Quota atteint — attente {wait}s (tentative {attempt+1}/{max_retries})")
                time.sleep(wait)

            # Timeout / connexion
            elif "timeout" in err_str or "connection" in err_str or "connect" in err_str:
                if attempt < max_retries - 1:
                    logger.warning(f"[LLM] Timeout réseau — retry dans {delay}s")
                    time.sleep(delay)
                    delay = min(delay * 2, 30)

            # Erreur inconnue — retry si pas dernier essai
            elif attempt < max_retries - 1:
                logger.warning(f"[LLM] Erreur ({type(e).__name__}) — retry dans {delay}s : {e}")
                time.sleep(delay)

            else:
                raise

    raise RuntimeError(f"LLM indisponible après {max_retries} tentatives. Dernière erreur : {last_error}")


def extract_text(response: Any) -> str:
    """Extrait le texte depuis n'importe quel type de réponse LangChain."""
    if response is None:
        return ""
    if hasattr(response, "content"):
        content = response.content
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return " ".join(
                item.get("text", "") if isinstance(item, dict) else str(item)
                for item in content
            )
    if isinstance(response, str):
        return response
    if isinstance(response, list):
        return " ".join(
            item.get("text", "") if isinstance(item, dict) else str(item)
            for item in response
        )
    return str(response)
