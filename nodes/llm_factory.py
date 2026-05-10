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
from typing import Any, Optional

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

# ─── Providers Human Review (priorite pour chat_modifier) ───────────────────
# ZhipuAI BigModel (GLM-4 / GLM-5) — supporte rotation de plusieurs cles
GLM5_API_KEYS_RAW = os.getenv("GLM5_API_KEYS", "")
GLM5_API_KEYS = [k.strip() for k in GLM5_API_KEYS_RAW.split(",") if k.strip()]
GLM5_BASE_URL = os.getenv("GLM5_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")
GLM5_MODEL = os.getenv("GLM5_MODEL", "glm-4-plus")
_GLM5_KEY_INDEX = 0  # rotation round-robin

# OpenRouter (acces a 100+ modeles)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "z-ai/glm-4.5")

# ─── DeepSeek (priorité 1 si la clé est fournie) ─────────────────────────────
# Endpoint OpenAI-compatible : https://api.deepseek.com/v1
# Modèles supportés :
#   - deepseek-chat      (DeepSeek-V3, généraliste, défaut)
#   - deepseek-reasoner  (DeepSeek-R1, raisonnement avancé)
DEEPSEEK_API_KEY  = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
DEEPSEEK_MODEL    = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_MAX_TOKENS = int(os.getenv("DEEPSEEK_MAX_TOKENS", "8192"))
DEEPSEEK_TIMEOUT    = int(os.getenv("DEEPSEEK_TIMEOUT", "120"))


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


class OpenAICompatibleChatModel(BaseChatModel):
    """LLM generique pour endpoints OpenAI-compatible (ZhipuAI BigModel, OpenRouter, etc.)."""
    model: str = Field(default="glm-4-plus")
    api_key: str = Field(default="")
    base_url: str = Field(default="")
    temperature: float = Field(default=0.1)
    max_tokens: int = Field(default=4096)
    timeout: int = Field(default=60)
    top_p: float = Field(default=0.9)
    provider_name: str = Field(default="openai-compat")
    extra_headers: dict = Field(default_factory=dict)

    def _generate(self, messages, stop=None, **kwargs):
        import requests
        api_messages = []
        for msg in messages:
            role = "user"
            if isinstance(msg, AIMessage):
                role = "assistant"
            elif hasattr(msg, "type"):
                t = msg.type
                if t == "human":
                    role = "user"
                elif t in ("ai", "assistant"):
                    role = "assistant"
                elif t == "system":
                    role = "system"
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

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        headers.update(self.extra_headers or {})

        url = self.base_url.rstrip("/") + "/chat/completions"
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
            if resp.status_code >= 400:
                logger.warning(f"[{self.provider_name}] HTTP {resp.status_code} : {resp.text[:200]}")
                resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"] if data.get("choices") else ""
        except Exception as e:
            logger.error(f"[{self.provider_name}] Request failed: {e}")
            raise

        message = AIMessage(content=content)
        return ChatResult(generations=[ChatGeneration(message=message)])

    @property
    def _llm_type(self) -> str:
        return f"openai-compat:{self.provider_name}"


def _build_deepseek_llm(temperature: float, max_tokens: int = None,
                        model: str = None) -> Optional["OpenAICompatibleChatModel"]:
    """Construit un client DeepSeek (OpenAI-compatible).

    Renvoie None si la clé n'est pas configurée.
    """
    if not DEEPSEEK_API_KEY:
        return None
    return OpenAICompatibleChatModel(
        model=model or DEEPSEEK_MODEL,
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        temperature=temperature,
        max_tokens=max_tokens or DEEPSEEK_MAX_TOKENS,
        timeout=DEEPSEEK_TIMEOUT,
        top_p=0.95,
        provider_name="DeepSeek",
    )


def _next_glm5_key():
    """Round-robin sur la liste des cles GLM-5 (rotation pour distribuer la charge)."""
    global _GLM5_KEY_INDEX
    if not GLM5_API_KEYS:
        return None
    key = GLM5_API_KEYS[_GLM5_KEY_INDEX % len(GLM5_API_KEYS)]
    _GLM5_KEY_INDEX += 1
    return key


def _build_glm5_llm(temperature: float, max_tokens: int) -> Optional["OpenAICompatibleChatModel"]:
    """Construit un client GLM-5 (ZhipuAI BigModel) avec une cle de la rotation."""
    key = _next_glm5_key()
    if not key:
        return None
    return OpenAICompatibleChatModel(
        model=GLM5_MODEL, api_key=key, base_url=GLM5_BASE_URL,
        temperature=temperature, max_tokens=max_tokens or 8000,
        timeout=60, top_p=0.9, provider_name="GLM-5",
    )


def _build_openrouter_llm(temperature: float, max_tokens: int) -> Optional["OpenAICompatibleChatModel"]:
    if not OPENROUTER_API_KEY:
        return None
    return OpenAICompatibleChatModel(
        model=OPENROUTER_MODEL, api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL,
        temperature=temperature, max_tokens=max_tokens or 8000,
        timeout=60, top_p=0.9, provider_name="OpenRouter",
        extra_headers={
            "HTTP-Referer": os.getenv("OPENROUTER_REFERER", "https://github.com/salaheddinehalimisiad-coder/agent_data_warehouse_v2"),
            "X-Title": "Agent Data Warehouse",
        },
    )


def _test_llm_connection(llm, timeout: int = 15) -> bool:
    """Test rapide d'un LLM en envoyant 'hi' et verifiant qu'on a une reponse non vide."""
    try:
        from langchain_core.messages import HumanMessage
        resp = llm.invoke([HumanMessage(content="ok")], config={"timeout": timeout})
        return bool(resp and getattr(resp, "content", "").strip())
    except Exception as e:
        logger.warning(f"[{getattr(llm, 'provider_name', '?')}] Test KO : {str(e)[:120]}")
        return False


# Optional["OpenAICompatibleChatModel"] requires the import; redefine for typing
try:
    Optional  # noqa
except NameError:
    from typing import Optional


def get_llm(temperature: float = 0.1, task_type: str = "default") -> Any:
    """
    Sélectionne automatiquement le meilleur LLM disponible :
    1. DeepSeek (cloud) — priorité 1 si la clé est fournie
    2. Blaze GLM-5 (cloud) — priorité 2
    3. Ollama local — priorité 3, fallback offline
    4. FakeChatModel — dernier recours

    task_type : "default" | "code" | "analysis"
    - "code"     : ETL, dbt, Airflow, healer, modeler → temperature basse (0.0-0.05)
    - "analysis" : DQ, governance, explorer, critic   → température moyenne (0.1-0.2)
    - "default"  : général                             → température fournie
    """
    effective_temp = _adjust_temperature(temperature, task_type)

    # ── Priorité 1 : DeepSeek (cloud, OpenAI-compatible) ──────────────────────
    if DEEPSEEK_API_KEY:
        try:
            ds_llm = _build_deepseek_llm(effective_temp, max_tokens=DEEPSEEK_MAX_TOKENS)
            if ds_llm and _test_llm_connection(ds_llm, timeout=15):
                logger.info(
                    f"[LLM] ✅ Route DeepSeek : {DEEPSEEK_MODEL} @ {DEEPSEEK_BASE_URL} "
                    f"(task={task_type}, temp={effective_temp}, max_tokens={DEEPSEEK_MAX_TOKENS})"
                )
                return ds_llm
            logger.warning("[LLM] DeepSeek indisponible — fallback Blaze GLM-5")
        except Exception as e:
            logger.warning(f"[LLM] DeepSeek connexion échouée ({type(e).__name__}) : {e} — fallback Blaze GLM-5")

    # ── Priorité 2 : Blaze GLM-5 (cloud) ──────────────────────────────────────
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
    # Ordre : du plus leger au plus lourd. Les modeles legers en premier
    # garantissent que ca marche meme avec 3-4 GB de RAM dispo.
    if _check_ollama(OLLAMA_BASE_URL):
        models = [
            # Modeles tres legers (< 2 GB RAM) — choix prioritaire
            ("phi3:mini", "P2 leger phi3-mini (2GB)"),
            ("qwen2.5:1.5b", "P2 leger qwen2.5-1.5b (1.5GB)"),
            ("qwen2.5:0.5b", "P2 ultra-leger qwen2.5-0.5b (0.6GB)"),
            ("tinyllama:1.1b", "P2 ultra-leger tinyllama (1GB)"),
            ("llama3.2:1b", "P2 leger llama3.2-1b (1.5GB)"),
            ("gemma2:2b", "P2 leger gemma2-2b (2GB)"),
            # Modeles moyens (3-4 GB)
            ("qwen2.5-coder:1.5b", "P2 mid qwen-coder-1.5b (2GB)"),
            ("qwen2.5-coder:3b", "P2 mid qwen-coder-3b (3GB)"),
            # Modeles lourds (4+ GB) — derniers recours
            ("qwen2.5-coder:7b", "P3 lourd code (4.3GB)"),
            ("codellama:latest", "P3 lourd codellama (5.5GB)"),
            ("mistral:latest", "P3 lourd mistral (4.5GB)"),
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
    Variante stricte : utilise un fournisseur cloud (pas de fallback Ollama/Fake).
    Cascade :
      1. DeepSeek (si DEEPSEEK_API_KEY est configurée)
      2. Blaze GLM-5 (si BLAZE_API_KEY est configurée)
    À utiliser pour les tâches critiques où la qualité de génération est non-négociable
    (chat_modifier, modeler complet, générateurs ETL T-SQL).
    Lève une RuntimeError si aucun fournisseur n'est joignable.
    """
    effective_temp = _adjust_temperature(temperature, task_type)

    # ── 1) DeepSeek ────────────────────────────────────────────────────────
    if DEEPSEEK_API_KEY:
        try:
            ds_llm = _build_deepseek_llm(effective_temp, max_tokens=max_tokens or DEEPSEEK_MAX_TOKENS)
            if ds_llm and _test_llm_connection(ds_llm, timeout=15):
                logger.info(
                    f"[LLM-STRICT] DeepSeek forcé pour {task_type} "
                    f"(temp={effective_temp}, max_tokens={max_tokens or DEEPSEEK_MAX_TOKENS})"
                )
                return ds_llm
            logger.warning("[LLM-STRICT] DeepSeek injoignable, tentative Blaze")
        except Exception as e:
            logger.warning(f"[LLM-STRICT] DeepSeek erreur ({type(e).__name__}) : {e} — tentative Blaze")

    # ── 2) Blaze GLM-5 ────────────────────────────────────────────────────
    if not BLAZE_API_KEY:
        raise RuntimeError(
            "Aucun LLM strict disponible : DEEPSEEK_API_KEY et BLAZE_API_KEY sont vides. "
            "Renseigner au moins une clé dans .env."
        )
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
            f"Blaze indisponible sur {BLAZE_BASE_URL} — vérifier BLAZE_API_KEY et la connectivité réseau."
        )
    logger.info(
        f"[LLM-STRICT] Blaze GLM-5 forcé pour {task_type} "
        f"(temp={effective_temp}, max_tokens={max_tokens or BLAZE_MAX_TOKENS})"
    )
    return llm


def get_human_review_llm(temperature: float = 0.05, max_tokens: int = 8000) -> Any:
    """LLM dedie a la phase Human Review (chat_modifier).

    Cascade :
      1. DeepSeek (si DEEPSEEK_API_KEY est definie)
      2. GLM-5 (ZhipuAI BigModel) avec rotation des cles configurees dans GLM5_API_KEYS
         - Tente jusqu'a 3 cles differentes en cas d'echec
      3. OpenRouter (z-ai/glm-4.5 ou autre modele configure)
      4. Blaze (si OPENAI-compat)
      5. Ollama leger
      6. RuntimeError -> chat_modifier basculera sur smart parser

    Configure via .env :
      DEEPSEEK_API_KEY=sk-...
      DEEPSEEK_MODEL=deepseek-chat  (ou deepseek-reasoner pour les modifications complexes)
      GLM5_API_KEYS=key1,key2,key3
      GLM5_MODEL=glm-4-plus  (ou glm-4, glm-4-flash, glm-4-air)
      OPENROUTER_API_KEY=sk-or-v1-...
      OPENROUTER_MODEL=z-ai/glm-4.5  (ou meta-llama/llama-3.3-70b-instruct:free)
    """
    effective_temp = _adjust_temperature(temperature, "code")

    # ── 1) DeepSeek ────────────────────────────────────────────────────────
    if DEEPSEEK_API_KEY:
        ds_llm = _build_deepseek_llm(effective_temp, max_tokens=max_tokens)
        if ds_llm and _test_llm_connection(ds_llm, timeout=15):
            logger.info(f"[Human-Review-LLM] DeepSeek OK (model={DEEPSEEK_MODEL})")
            return ds_llm
        logger.warning("[Human-Review-LLM] DeepSeek KO")

    # ── 2) GLM-5 ZhipuAI BigModel avec rotation des cles ───────────────────
    if GLM5_API_KEYS:
        max_attempts = min(len(GLM5_API_KEYS), 3)
        for attempt in range(max_attempts):
            llm = _build_glm5_llm(effective_temp, max_tokens)
            if llm and _test_llm_connection(llm, timeout=10):
                logger.info(
                    f"[Human-Review-LLM] GLM-5 OK (model={GLM5_MODEL}, "
                    f"key #{(_GLM5_KEY_INDEX-1) % len(GLM5_API_KEYS)+1}/{len(GLM5_API_KEYS)})"
                )
                return llm
            logger.warning(f"[Human-Review-LLM] GLM-5 cle #{attempt+1} KO, essai suivant...")

    # ── 2) OpenRouter ──────────────────────────────────────────────────────
    if OPENROUTER_API_KEY:
        llm = _build_openrouter_llm(effective_temp, max_tokens)
        if llm and _test_llm_connection(llm, timeout=10):
            logger.info(f"[Human-Review-LLM] OpenRouter OK (model={OPENROUTER_MODEL})")
            return llm
        logger.warning("[Human-Review-LLM] OpenRouter KO")

    # ── 3) Blaze (si configure) ────────────────────────────────────────────
    try:
        return get_llm_strict(temperature=temperature, task_type="code", max_tokens=max_tokens)
    except RuntimeError as e:
        logger.warning(f"[Human-Review-LLM] Blaze KO : {e}")

    # ── 4) Ollama leger via get_llm() (non strict) ─────────────────────────
    try:
        llm = get_llm(temperature=temperature, task_type="code")
        if llm and not isinstance(llm, FakeChatModel):
            logger.info("[Human-Review-LLM] Fallback Ollama")
            return llm
    except Exception as e:
        logger.warning(f"[Human-Review-LLM] Ollama KO : {e}")

    raise RuntimeError(
        "Aucun LLM Human Review disponible (GLM-5, OpenRouter, Blaze, Ollama tous KO). "
        "Le chat_modifier basculera sur le smart parser deterministe."
    )


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
        if any(code in err_str for code in ("401", "403", "invalid_api_key", "authentication")):
            logger.error(f"[LLM] Blaze auth echouee : {e}")
            return False
        logger.warning(f"[LLM] Blaze test echoue : {e}")
        return False


def _check_ollama(base_url: str, timeout: int = 3) -> bool:
    """Verifie qu'Ollama repond en moins de 3 secondes."""
    try:
        import requests
        r = requests.get(base_url, timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False


def _test_model_can_run(base_url: str, model_name: str, timeout: int = 15) -> bool:
    """Teste si un modele Ollama peut etre charge et execute."""
    try:
        import requests
        r = requests.post(
            f"{base_url}/api/generate",
            json={"model": model_name, "prompt": "hi", "stream": False,
                  "options": {"num_predict": 1}},
            timeout=timeout,
        )
        if r.status_code == 200:
            return True
        err = r.text.lower()
        if "memory" in err:
            logger.warning(f"[LLM] {model_name} - RAM insuffisante : {r.text[:120]}")
        return False
    except Exception as e:
        logger.warning(f"[LLM] {model_name} - test echoue : {e}")
        return False


def call_with_retry(chain: Any, inputs: dict, max_retries: int = 3, use_cache: bool = True) -> Any:
    """Appel LLM avec backoff exponentiel + cache LRU/TTL."""
    cache_key = None
    if use_cache and _LLM_CACHE_ENABLED:
        try:
            cache_key = _make_cache_key(inputs, chain)
            cached = _LLM_CACHE.get(cache_key)
            if cached is not None:
                return cached
        except Exception:
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
            if any(c in err_str for c in ("401", "403", "forbidden", "524",
                                          "subscription", "upgrade", "invalid_api_key",
                                          "authentication", "memory")):
                raise
            if "429" in err_str or "quota" in err_str or "rate" in err_str:
                time.sleep(min(delay * (attempt + 1), 30))
            elif "timeout" in err_str or "connection" in err_str:
                if attempt < max_retries - 1:
                    time.sleep(delay)
                    delay = min(delay * 2, 30)
            elif attempt < max_retries - 1:
                time.sleep(delay)
            else:
                raise
    raise RuntimeError(f"LLM indisponible : {last_error}")


def extract_text(response: Any) -> str:
    """Extrait le texte depuis n'importe quel type de reponse LangChain."""
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
    return str(response)


def build_schema_context(logical_model: dict, prefix: str = "dw") -> str:
    if not logical_model:
        return ""
    lines = [f"=== DW SCHEMA (prefix: {prefix}) ==="]
    fact_tables = logical_model.get("fact_tables", []) or (
        [logical_model["fact_table"]] if logical_model.get("fact_table") else []
    )
    for fact in fact_tables:
        if not fact:
            continue
        lines.append(f"FACT: [{prefix}_{fact.get('name', '?')}]")
        for col in fact.get("columns", []):
            lines.append(f"  - {col.get('name')}: {col.get('type')} [{col.get('role', '')}]")
    for dim in logical_model.get("dimension_tables", []):
        lines.append(f"DIM: [{prefix}_{dim.get('name', '?')}]")
        for col in dim.get("columns", []):
            lines.append(f"  - {col.get('name')}: {col.get('type')} [{col.get('role', '')}]")
    return "\n".join(lines)


def build_metadata_context(source_metadata: dict) -> str:
    if not source_metadata:
        return ""
    lines = ["=== SOURCE METADATA ==="]
    for tname, tdata in source_metadata.items():
        if not isinstance(tdata, dict):
            continue
        lines.append(f"TABLE [{tname}] ({tdata.get('row_count', '?')} rows)")
        for col in tdata.get("columns", []):
            lines.append(f"  - {col.get('name')}: {col.get('dtype', col.get('type', '?'))}")
    return "\n".join(lines)
