"""api/middleware/observability.py - Prometheus metrics + structured logs."""
import json
import logging
import time
from typing import Callable

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ─── Prometheus metrics (lazy import) ────────────────────────────────────────
_METRICS = {}


def _ensure_metrics():
    """Lazy init pour ne pas planter si prometheus_client n'est pas installe."""
    if _METRICS:
        return _METRICS
    try:
        from prometheus_client import Counter, Gauge, Histogram, CollectorRegistry
        registry = CollectorRegistry()
        _METRICS["registry"] = registry
        _METRICS["http_requests_total"] = Counter(
            "http_requests_total", "Total HTTP requests",
            ["method", "path", "status"], registry=registry,
        )
        _METRICS["http_request_duration_seconds"] = Histogram(
            "http_request_duration_seconds", "HTTP request latency",
            ["method", "path"], registry=registry,
            buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60),
        )
        _METRICS["http_in_flight"] = Gauge(
            "http_requests_in_flight", "Current in-flight HTTP requests",
            registry=registry,
        )
        _METRICS["pipeline_runs_total"] = Counter(
            "pipeline_runs_total", "Total pipeline runs", ["status"], registry=registry,
        )
        _METRICS["llm_calls_total"] = Counter(
            "llm_calls_total", "LLM calls", ["provider", "task_type"], registry=registry,
        )
        _METRICS["llm_cache_hits_total"] = Counter(
            "llm_cache_hits_total", "LLM cache hits", registry=registry,
        )
    except ImportError:
        logger.warning("prometheus_client non installe - metrics desactivees")
        _METRICS["disabled"] = True
    return _METRICS


def _normalize_path(path: str) -> str:
    """Reduit la cardinalite : /api/sessions/abc123 -> /api/sessions/{id}."""
    parts = path.split("/")
    out = []
    for p in parts:
        if not p:
            out.append(p); continue
        if len(p) >= 16 and any(c.isdigit() for c in p):
            out.append("{id}")
        elif p.replace("-", "").isalnum() and len(p) >= 8 and any(c.isdigit() for c in p):
            out.append("{id}")
        else:
            out.append(p)
    return "/".join(out) or "/"


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        m = _ensure_metrics()
        if m.get("disabled"):
            return await call_next(request)
        path = _normalize_path(request.url.path)
        method = request.method
        m["http_in_flight"].inc()
        start = time.perf_counter()
        status_code = "500"
        try:
            response = await call_next(request)
            status_code = str(response.status_code)
            return response
        finally:
            duration = time.perf_counter() - start
            m["http_in_flight"].dec()
            try:
                m["http_requests_total"].labels(method=method, path=path, status=status_code).inc()
                m["http_request_duration_seconds"].labels(method=method, path=path).observe(duration)
            except Exception:
                pass


class JSONLogFormatter(logging.Formatter):
    """Format les logs en JSON pour ingestion ELK/Loki."""
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        # Champs extras passes via logger.info(..., extra={...})
        for k, v in record.__dict__.items():
            if k in ("args","asctime","created","exc_info","exc_text","filename","funcName",
                    "levelname","levelno","lineno","module","msecs","message","msg","name",
                    "pathname","process","processName","relativeCreated","stack_info","thread","threadName"):
                continue
            try:
                json.dumps(v)
                payload[k] = v
            except Exception:
                payload[k] = str(v)
        return json.dumps(payload, ensure_ascii=False)


def configure_json_logs(level: str = "INFO"):
    """Active les logs JSON. A appeler au demarrage de l'app si LOG_FORMAT=json."""
    root = logging.getLogger()
    handler = logging.StreamHandler()
    handler.setFormatter(JSONLogFormatter())
    # Remplace les handlers existants
    root.handlers = [handler]
    root.setLevel(getattr(logging, level.upper(), logging.INFO))


def setup_observability(app: FastAPI) -> None:
    """Branche middleware Prometheus + endpoint /metrics sur l'app FastAPI."""
    import os
    if os.getenv("LOG_FORMAT", "").lower() == "json":
        configure_json_logs(os.getenv("LOG_LEVEL", "info"))

    if os.getenv("METRICS_ENABLED", "1") in ("0", "false", "False"):
        logger.info("[Obs] METRICS_ENABLED=0 - middleware skipped")
        return

    m = _ensure_metrics()
    if m.get("disabled"):
        return

    app.add_middleware(PrometheusMiddleware)

    @app.get("/metrics", include_in_schema=False)
    async def metrics_endpoint():
        from fastapi.responses import Response
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        # Inclut les stats du cache LLM si dispo
        try:
            from nodes.llm_factory import get_llm_cache_stats
            stats = get_llm_cache_stats()
            # increment compteur cache hits depuis stats
            current_hits = stats.get("hits", 0)
            existing = getattr(metrics_endpoint, "_last_hits", 0)
            if current_hits > existing:
                _METRICS["llm_cache_hits_total"].inc(current_hits - existing)
                metrics_endpoint._last_hits = current_hits
        except Exception:
            pass
        return Response(
            content=generate_latest(_METRICS["registry"]),
            media_type=CONTENT_TYPE_LATEST,
        )
