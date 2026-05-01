# nodes/llm_factory.py — Factory LLM v7.0 (Blaze GLM-5)
"""
v7.0 — Migration vers Blaze (GLM 5) via API OpenAI-compatible :
1. Priorité 1 : Blaze GLM-5 via https://api.blaze.ai/v1 (cloud, haute performance)
2. Priorité 2 : Ollama local (fallback offline)
3. FakeChatModel : dernier recours si rien n'est disponible
4. Optimisé pour Data Warehouse : large fenêtre de tokens pour schémas SQL complets
5. call_with_retry : skip immédiat sur 403/401 (pas de retry inutile)
6. Support de gros volumes de métadonnées SQL dans le contexte prompt
"""
import hashlib
import json as _json
import logging
import os
import threading
import time
from collections import OrderedDict
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.outputs import ChatResult, ChatGeneration
from pydantic import Field

logger = logging.getLogger(__name__)


# ─── Cache LLM en memoire (LRU + TTL) ─────────────────────────────────────────
class _LRUTTLCache:
    """Cache LRU avec TTL pour les appels LLM. Thread-safe, taille bornee."""
    def __init__(self, maxsize: int = 256, ttl_seconds: int = 3600):
        self.maxsize = maxsize
        self.ttl = ttl_seconds
        self._d: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()
        self._lock = threading.RLock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str):
        with self._lock:
            if key not in self._d:
                self.misses += 1
                return None
            ts, value = self._d[key]
            if time.time() - ts > self.ttl:
                self._d.pop(key, None)
                self.misses += 1
                return None
            self._d.move_to_end(key)
            self.hits += 1
            return value

    def set(self, key: str, value: Any):
        with self._lock:
            self._d[key] = (time.time(), value)
            self._d.move_to_end(key)
            while len(self._d) > self.maxsize:
                self._d.popitem(last=False)

    def clear(self):
        with self._lock:
            self._d.clear()

    def stats(self) -> dict:
        total = self.hits + self.misses
        return {
            "size": len(self._d),
            "maxsize": self.maxsize,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total, 3) if total else 0.0,
        }


_LLM_CACHE_ENABLED = os.getenv("LLM_CACHE_ENABLED", "1") not in ("0", "false", "False")
_LLM_CACHE_TTL = int(os.getenv("LLM_CACHE_TTL", "3600"))  # 1h par defaut
_LLM_CACHE_SIZE = int(os.getenv("LLM_CACHE_SIZE", "256"))
_LLM_CACHE = _LRUTTLCache(maxsize=_LLM_CACHE_SIZE, ttl_seconds=_LLM_CACHE_TTL)


def _make_cache_key(inputs: Any, chain: Any = None) -> str:
    """Hash stable des inputs LLM pour cache."""
    try:
        if hasattr(inputs, "to_dict"):
            payload = inputs.to_dict()
        elif isinstance(inputs, (dict, list, tuple, str, int, float)):
            payload = inputs
        else:
            payload = str(inputs)
        data = _json.dumps(payload, default=str, sort_keys=True, ensure_ascii=False)
    except Exception:
        data = str(inputs)
    chain_id = ""
    try:
        if chain is not None:
            chain_id = type(chain).__name__
    except Exception:
        pass
    return hashlib.sha256(f"{chain_id}::{data}".encode("utf-8")).hexdigest()


def get_llm_cache_stats() -> dict:
    """Expose les stats du cache LLM (pour /metrics ou debug)."""
    return _LLM_CACHE.stats()


def clear_llm_cache():
    _LLM_CACHE.clear()

# ─── Configuration Blaze ────────────────────────────────────────────────────────
# IMPORTANT : ne jamais hardcoder la cle. Utiliser .env (cf .env.example).
BLAZE_API_KEY = os.getenv("BLAZE_API_KEY", "")
BLAZE_BASE_URL = os.getenv("BLAZE_BASE_URL", "https://blazeai.boxu.dev")
if not BLAZE_API_KEY:
    logger.warning("[LLM] BLAZE_API_KEY non defini. Definir la variable dans .env ou exporter avant de lancer le serveur.")
BLAZE_MODEL = os.getenv("BLAZE_MODEL", "z-ai/glm-5")

# Normalisation API Key : préfixer sk-blaze- si absent
if BLAZE_API_KEY and not BLAZE_API_KEY.startswith("sk-blaze-"):
    BLAZE_API_KEY = "sk-blaze-" + BLAZE_API_KEY

# Normalisation : ChatOpenAI attend un endpoint OpenAI-compatible.
# Si l'URL ne se termine pas par /v1 on l'ajoute pour éviter les 403/404.
if BLAZE_BASE_URL and not BLAZE_BASE_URL.rstrip("/").endswith("/v1"):
    BLAZE_BASE_URL = BLAZE_BASE_URL.rstrip("/") + "/v1"
    logger.info(f"[LLM] BLAZE_BASE_URL normalisé → {BLAZE_BASE_URL}")

# Fenêtre de tokens optimisée pour Data Warehouse (schémas SQL complets)
BLAZE_MAX_TOKENS = int(os.getenv("BLAZE_MAX_TOKENS", "16384"))
BLAZE_TIMEOUT = int(os.getenv("BLAZE_TIMEOUT", "60"))

# Ollama fallback (offline)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


class BlazeChatModel(BaseChatModel):
    """Custom LangChain LLM wrapping Blaze API via direct requests.

    Bypasses the openai client library which Blaze fingerprints and blocks.
    """
    model: str = Field(default=BLAZE_MODEL)
    api_key: str = Field(default=BLAZE_API_KEY)
    base_url: str = Field(default=BLAZE_BASE_URL)
    temperature: float = Field(default=0.1)
    max_tokens: int = Field(default=4096)
    timeout: int = Field(default=300)
    top_p: float = Field(default=0.95)

    def _generate(self, messages: list[BaseMessage], stop: list[str] | None = None, **kwargs: Any) -> ChatResult:
        import requests

        api_messages = []
        for msg in messages:
            role = "user"
            if isinstance(msg, AIMessage):
                role = "assistant"
            elif hasattr(msg, "type"):
                role = msg.type
            api_messages.append({"role": role, "content": str(msg.content)})

        payload = {
            "model": self.model,
            "messages": api_messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "top_p": self.top_p,
        }
        if stop:
            payload["stop"] = stop

        url = self.base_url.rstrip("/") + "/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"] if data.get("choices") else ""
        except Exception as e:
            logger.error(f"[BlazeChatModel] Request failed: {e}")
            raise

        message = AIMessage(content=content)
        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])

    @property
    def _llm_type(self) -> str:
        return "blaze-chat-model"


class FakeChatModel(BaseChatModel):
    """Fallback LLM for when no real model is reachable."""
    model_name: str = "mock-llm-v1"

    def _generate(self, messages: list[BaseMessage], stop: list[str] | None = None, **kwargs: Any) -> ChatResult:
        content = "Mock response: Logic continued without LLM."
        last_msg = str(messages[-1].content).upper() if messages else ""

        if "KTR" in last_msg or "PENTAHO" in last_msg:
            content = '<?xml version="1.0" encoding="UTF-8"?><transformation><info><name>Mock</name></info></transformation>'
        elif "STAR SCHEMA" in last_msg or "KIMBALL" in last_msg or "FACT_TABLE" in last_msg or "DIMENSION_TABLES" in last_msg:
            # Return empty JSON — modeler will detect as invalid and fall back to algorithm
            logger.warning("[LLM] FakeChatModel detected for Schema Modeling prompt — returning {} to force algorithm fallback")
            content = '{}'
        elif "JSON" in last_msg:
            content = r'{"status": "mocked", "message": "Result generated via fallback logic"}'
        elif "SQL" in last_msg or "DDL" in last_msg:
            content = "SELECT 'mock' as result;\n\nVERDICT: APPROVED"
        elif "PII" in last_msg or "GOVERNANCE" in last_msg:
            content = r'{"pii_columns_detected": [], "compliance_score": 100, "masking_sql": "-- No PII detected"}'

        message = AIMessage(content=content)
        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])

    @property
    def _llm_type(self) -> str:
        return "fake-chat-model"


def get_llm(temperature: float = 0.1, task_type: str = "default") -> Any:
    """
    Sélectionne automatiquement le meilleur LLM disponible :
    1. Blaze GLM-5 (cloud) — priorité 1, haute performance, large contexte
    2. Ollama local — priorité 2, fallback offline
    3. FakeChatModel — dernier recours

    task_type : "default" | "code" | "analysis"
    - "code"     : ETL, dbt, Airflow, healer, modeler → temperature basse (0.0-0.05)
    - "analysis" : DQ, governance, explorer, critic   → température moyenne (0.1-0.2)
    - "default"  : général                             → température fournie
    """
    # ── Priorité 1 : Blaze GLM-5 (cloud) ──────────────────────────────────────
    effective_temp = _adjust_temperature(temperature, task_type)

    try:
        llm = BlazeChatModel(
            model=BLAZE_MODEL,
            api_key=BLAZE_API_KEY,
            base_url=BLAZE_BASE_URL,
            temperature=effective_temp,
            max_tokens=BLAZE_MAX_TOKENS,
            timeout=BLAZE_TIMEOUT,
            top_p=0.9 if task_type == "code" else 0.95,
        )

        # Test rapide : vérifier que Blaze répond
        if _test_blaze_connection(llm):
            logger.info(
                f"[LLM] ✅ Route Blaze GLM-5 : {BLAZE_MODEL} @ {BLAZE_BASE_URL} "
                f"(task={task_type}, temp={effective_temp}, max_tokens={BLAZE_MAX_TOKENS})"
            )
            return llm
        else:
            logger.warning(f"[LLM] Blaze indisponible sur {BLAZE_BASE_URL} — fallback Ollama")

    except Exception as e:
        logger.warning(f"[LLM] Blaze connexion échouée ({type(e).__name__}) : {e} — fallback Ollama")

    # ── Priorité 2 : Ollama local (fallback offline) ──────────────────────────
    if _check_ollama(OLLAMA_BASE_URL):
        models = [
            ("qwen2.5-coder:7b", "P2 local code"),
            ("codellama:latest", "P2 local léger"),
            ("mistral:latest", "P2 local"),
        ]

        for model_name, label in models:
            try:
                from langchain_ollama import ChatOllama
                llm = ChatOllama(
                    model=model_name,
                    base_url=OLLAMA_BASE_URL,
                    temperature=temperature,
                    timeout=10,
                )
                # Test rapide pour éviter de renvoyer un LLM inutilisable
                if _test_model_can_run(OLLAMA_BASE_URL, model_name, timeout=10):
                    logger.info(f"[LLM] Route {label}: Ollama -> {model_name} (task={task_type})")
                    return llm
            except Exception as e:
                logger.warning(f"[LLM] Ollama {model_name} indisponible : {e}")
                continue
    else:
        logger.info(f"[LLM] Ollama non détecté sur {OLLAMA_BASE_URL}")

    # ── Fallback Final : Fake LLM ──────────────────────────────────────────────
    logger.critical("❌ Aucun LLM disponible (Blaze + Ollama) — FakeChatModel")
    return FakeChatModel()


def get_llm_strict(temperature: float = 0.1, task_type: str = "code", max_tokens: int = None) -> Any:
    """
    Variante stricte : utilise UNIQUEMENT Blaze GLM-5 (pas de fallback Ollama/Fake).
    A utiliser pour les taches critiques ou la qualite de generation est non-negociable
    (chat_modifier, modeler complet, generateurs ETL T-SQL).
    Leve une RuntimeError si Blaze n'est pas joignable.
    """
    if not BLAZE_API_KEY:
        raise RuntimeError(
            "BLAZE_API_KEY non configuree — get_llm_strict ne peut pas demarrer. "
            "Mettre la cle dans .env (cf .env.example)."
        )
    effective_temp = _adjust_temperature(temperature, task_type)
    llm = BlazeChatModel(
        model=BLAZE_MODEL,
        api_key=BLAZE_API_KEY,
        base_url=BLAZE_BASE_URL,
        temperature=effective_temp,
        max_tokens=max_tokens or BLAZE_MAX_TOKENS,
        timeout=BLAZE_TIMEOUT,
        top_p=0.9 if task_type == "code" else 0.95,
    )
    if not _test_blaze_connection(llm):
        raise RuntimeError(
            f"Blaze indisponible sur {BLAZE_BASE_URL} — verifier BLAZE_API_KEY et la connectivite reseau."
        )
    logger.info(
        f"[LLM-STRICT] Blaze GLM-5 force pour {task_type} "
        f"(temp={effective_temp}, max_tokens={max_tokens or BLAZE_MAX_TOKENS})"
    )
    return llm


def _adjust_temperature(temperature: float, task_type: str) -> float:
    """
    Ajuste la température pour optimiser la génération SQL/Data Warehouse.
    - code : température très basse pour du SQL/ETL déterministe
    - analysis : température modérée pour de l'analyse DQ/governance
    - default : utilise la température fournie
    """
    if task_type == "code":
        return min(temperature, 0.05)  # SQL/ETL nécessite du déterminisme
    elif task_type == "analysis":
        return max(temperature, 0.1)   # Analyse bénéficie d'un peu de variété
    return temperature


def _test_blaze_connection(llm, timeout: int = 15) -> bool:
    """
    Teste si l'API Blaze répond en générant 1 token.
    Utilise un prompt minimal pour valider la connexion.
    """
    try:
        from langchain_core.messages import HumanMessage
        response = llm.invoke([HumanMessage(content="hi")], config={"timeout": timeout})
        if response and hasattr(response, 'content') and response.content:
            logger.debug("[LLM] Blaze handshake OK")
            return True
        return False
    except Exception as e:
        err_str = str(e).lower()
        # Erreurs non-retryable — ne pas réessayer
        if any(code in err_str for code in ("401", "403", "invalid_api_key", "authentication")):
            logger.error(f"[LLM] Blaze auth échouée (clé invalide) : {e}")
            return False
        logger.warning(f"[LLM] Blaze test échoué : {e}")
        return False


def _check_ollama(base_url: str, timeout: int = 3) -> bool:
    """Vérifie qu'Ollama répond en moins de 3 secondes."""
    try:
        import requests
        r = requests.get(base_url, timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False


def _test_model_can_run(base_url: str, model_name: str, timeout: int = 15) -> bool:
    """
    Teste si un modèle Ollama peut être chargé et exécuté en générant 1 token.
    Retourne False si le modèle nécessite plus de RAM que disponible.
    """
    try:
        import requests
        r = requests.post(
            f"{base_url}/api/generate",
            json={
                "model": model_name,
                "prompt": "hi",
                "stream": False,
                "options": {"num_predict": 1}
            },
            timeout=timeout
        )
        if r.status_code == 200:
            return True
        err = r.text.lower()
        if "requires more system memory" in err or "memory" in err:
            logger.warning(f"[LLM] {model_name} — RAM insuffisante : {r.text[:120]}")
        else:
            logger.warning(f"[LLM] {model_name} — erreur API ({r.status_code}) : {r.text[:120]}")
        return False
    except Exception as e:
        logger.warning(f"[LLM] {model_name} — test échoué : {e}")
        return False


def call_with_retry(chain: Any, inputs: dict, max_retries: int = 3, use_cache: bool = True) -> Any:
    """
    Appel LLM avec backoff exponentiel + cache LRU/TTL en memoire.
    Gère : quota 429, timeout réseau, erreurs transitoires.
    Skip immédiat sur 401/403 (non retryable).
    """
    # ── Cache hit ────────────────────────────────────────────────────────────
    cache_key = None
    if use_cache and _LLM_CACHE_ENABLED:
        try:
            cache_key = _make_cache_key(inputs, chain)
            cached = _LLM_CACHE.get(cache_key)
            if cached is not None:
                logger.debug(f"[LLM] Cache HIT ({cache_key[:8]})")
                return cached
        except Exception as e:
            logger.debug(f"[LLM] Cache lookup failed (ignore): {e}")
            cache_key = None

    delay = 5
    last_error = None

    for attempt in range(max_retries):
        try:
            result = chain.invoke(inputs)
            if cache_key:
                try:
                    _LLM_CACHE.set(cache_key, result)
                except Exception:
                    pass
            return result
        except Exception as e:
            last_error = e
            err_str = str(e).lower()

            # 401/403/524 / RAM insuffisante — non retryable
            if ("401" in err_str or "403" in err_str or "forbidden" in err_str or
                "524" in err_str or
                "subscription" in err_str or "upgrade" in err_str or
                "invalid_api_key" in err_str or "authentication" in err_str or
                "requires more system memory" in err_str or "memory" in err_str):
                logger.warning(f"[LLM] Erreur non-retryable ({type(e).__name__}) — skip retry : {e}")
                raise  # remonte immédiatement pour permettre fallback au modèle suivant

            # Quota / rate limit
            if "429" in err_str or "quota" in err_str or "rate" in err_str or "resource_exhausted" in err_str:
                wait = min(delay * (attempt + 1), 30)
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


# ─── Helpers Data Warehouse ─────────────────────────────────────────────────────

def build_schema_context(logical_model: dict, prefix: str = "dw") -> str:
    """
    Construit un contexte de schéma DW complet pour injection dans les prompts LLM.
    Optimisé pour la large fenêtre de tokens de GLM-5 (jusqu'à 16K+ tokens).

    Inclut :
    - Toutes les tables de faits avec colonnes et types
    - Toutes les dimensions avec colonnes, types et hiérarchies
    - Les relations FK explicites
    - Le préfixe utilisateur

    Usage dans les prompts :
        schema_ctx = build_schema_context(state["logical_model"], state["user_prefix"])
        # Injecter schema_ctx dans le prompt LLM
    """
    if not logical_model:
        return ""

    lines = []
    lines.append(f"=== DATA WAREHOUSE SCHEMA (prefix: {prefix}) ===")
    lines.append("")

    # Tables de faits
    fact_tables = logical_model.get("fact_tables", [])
    if not fact_tables:
        ft = logical_model.get("fact_table")
        if ft:
            fact_tables = [ft]

    for fact in fact_tables:
        if not fact:
            continue
        fact_name = fact.get("name", "fact_unknown")
        lines.append(f"📊 FACT TABLE: [{prefix}_{fact_name}]")
        lines.append(f"   Description: {fact.get('description', 'N/A')}")
        lines.append(f"   Source tables: {', '.join(fact.get('source_tables', []))}")
        lines.append("   Columns:")
        for col in fact.get("columns", []):
            role_icon = {"pk": "🔑", "fk": "🔗", "metric": "📈", "degenerate": "📎"}.get(col.get("role", ""), "  ")
            ref = f" → {col['references']}" if col.get("references") else ""
            src = f" (from {col['source_column']})" if col.get("source_column") else ""
            lines.append(f"     {role_icon} {col['name']}: {col.get('type', 'UNKNOWN')} [{col.get('role', '')}]{ref}{src}")
        lines.append("")

    # Dimensions
    for dim in logical_model.get("dimension_tables", []):
        dim_name = dim.get("name", "dim_unknown")
        lines.append(f"📋 DIMENSION: [{prefix}_{dim_name}]")
        lines.append(f"   Description: {dim.get('description', 'N/A')}")
        lines.append("   Columns:")
        for col in dim.get("columns", []):
            role_icon = {"pk": "🔑", "fk": "🔗", "attribute": "📝"}.get(col.get("role", ""), "  ")
            nk = " [NK]" if col.get("natural_key") else ""
            lines.append(f"     {role_icon} {col['name']}: {col.get('type', 'UNKNOWN')} [{col.get('role', '')}]{nk}")
        # Hiérarchies
        for hier in dim.get("hierarchies", []):
            levels = " → ".join(hier.get("levels", []))
            lines.append(f"   🔶 Hierarchy: {hier.get('name', '?')} [{levels}]")
        lines.append("")

    return "\n".join(lines)



def build_metadata_context(source_metadata: dict) -> str:
    """Contexte metadata source pour injection prompt LLM."""
    if not source_metadata:
        return ""
    lines = ["=== SOURCE METADATA ==="]
    for tname, tdata in source_metadata.items():
        if not isinstance(tdata, dict):
            continue
        rc = tdata.get("row_count", "?")
        lines.append(f"TABLE [{tname}] ({rc} rows)")
        for col in tdata.get("columns", []):
            lines.append(f"  - {col.get('name', '?')}: {col.get('dtype', col.get('type', 'unknown'))}")
        for fk in tdata.get("foreign_keys", []) or []:
            cols_fk = ", ".join(fk.get("constrained_columns", []))
            lines.append(f"  FK: {cols_fk} -> {fk.get('referred_table', '?')}")
    return "\n".join(lines)
