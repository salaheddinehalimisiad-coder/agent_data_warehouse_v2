"""Tests pour nodes/llm_factory.py - cache LRU/TTL + helpers."""
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

# Mock LangChain pour pouvoir importer le module
for m in ['langchain_core', 'langchain_core.language_models',
          'langchain_core.language_models.chat_models',
          'langchain_core.messages', 'langchain_core.outputs',
          'langchain_core.prompts']:
    sys.modules.setdefault(m, MagicMock())

# Charger le source directement
SRC = open(ROOT / "nodes" / "llm_factory.py", encoding="utf-8").read()
NS = {"__name__": "__test_llm_factory__"}
exec(compile(SRC, "llm_factory", "exec"), NS)

import pytest


# ─── Cache LRU/TTL ──────────────────────────────────────────────────────

class TestLRUTTLCache:
    def test_set_get(self):
        cache = NS["_LRUTTLCache"](maxsize=3, ttl_seconds=10)
        cache.set("k1", "v1")
        assert cache.get("k1") == "v1"

    def test_miss_increments_counter(self):
        cache = NS["_LRUTTLCache"](maxsize=3, ttl_seconds=10)
        cache.get("ghost")
        assert cache.misses == 1
        assert cache.hits == 0

    def test_lru_eviction(self):
        cache = NS["_LRUTTLCache"](maxsize=2, ttl_seconds=10)
        cache.set("a", 1); cache.set("b", 2); cache.set("c", 3)
        assert cache.get("a") is None  # evincte
        assert cache.get("b") == 2
        assert cache.get("c") == 3

    def test_ttl_expiry(self):
        cache = NS["_LRUTTLCache"](maxsize=3, ttl_seconds=0)  # expire immediatement
        cache.set("k", "v")
        time.sleep(0.01)
        assert cache.get("k") is None  # expire

    def test_clear(self):
        cache = NS["_LRUTTLCache"](maxsize=3, ttl_seconds=10)
        cache.set("k", "v")
        cache.clear()
        assert cache.get("k") is None

    def test_stats(self):
        cache = NS["_LRUTTLCache"](maxsize=3, ttl_seconds=10)
        cache.set("k", "v")
        cache.get("k")
        cache.get("ghost")
        s = cache.stats()
        assert s["size"] == 1
        assert s["hits"] == 1
        assert s["misses"] == 1
        assert s["hit_rate"] == 0.5


class TestCacheKey:
    def test_same_inputs_same_key(self):
        k1 = NS["_make_cache_key"]({"a": 1, "b": 2})
        k2 = NS["_make_cache_key"]({"b": 2, "a": 1})  # ordre different
        assert k1 == k2  # sort_keys garantit la stabilite

    def test_different_inputs_different_keys(self):
        k1 = NS["_make_cache_key"]({"a": 1})
        k2 = NS["_make_cache_key"]({"a": 2})
        assert k1 != k2

    def test_handles_non_serializable(self):
        # Doit fallback sur str() sans crash
        class Foo: pass
        k = NS["_make_cache_key"](Foo())
        assert isinstance(k, str)
        assert len(k) == 64  # sha256 hex


class TestExtractText:
    def test_string_response(self):
        assert NS["extract_text"]("hello") == "hello"

    def test_obj_with_content_str(self):
        obj = type("R", (), {"content": "world"})()
        assert NS["extract_text"](obj) == "world"

    def test_obj_with_content_list_dicts(self):
        obj = type("R", (), {"content": [{"text": "a"}, {"text": "b"}]})()
        assert NS["extract_text"](obj) == "a b"

    def test_none(self):
        assert NS["extract_text"](None) == ""


class TestAdjustTemperature:
    def test_code_clamps_low(self):
        assert NS["_adjust_temperature"](0.5, "code") == 0.05

    def test_analysis_floors_at_0_1(self):
        assert NS["_adjust_temperature"](0.0, "analysis") == 0.1

    def test_default_passthrough(self):
        assert NS["_adjust_temperature"](0.3, "default") == 0.3
