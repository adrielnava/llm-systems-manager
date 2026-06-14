"""Tests for NotificationRepository.update_config persistence ordering (#12).

A failed SQLite persist must propagate (so the route 500s) and must not leave
the cache holding the new value ahead of the durable store.
"""
from __future__ import annotations

import uuid

import pytest

from backend._time import now_utc
from backend.models.notification import NotificationConfig, NotificationConfigUpdate
from backend.storage.cache import MetricCache
from backend.storage.repositories import NotificationRepository


class _RaisingSettingsDB:
    """settings_db stand-in whose write_config always fails."""

    def __init__(self) -> None:
        self.write_calls = 0

    def get_config(self, config_id):
        return None

    def write_config(self, cfg):
        self.write_calls += 1
        raise RuntimeError("simulated SQLite write failure")


class _OkSettingsDB:
    """settings_db stand-in that records writes in memory."""

    def __init__(self) -> None:
        self.written: dict[str, dict] = {}

    def get_config(self, config_id):
        return self.written.get(str(config_id))

    def write_config(self, cfg):
        self.written[str(cfg["config_id"])] = cfg


def _seed_config(cache: MetricCache, name: str = "original") -> NotificationConfig:
    cfg = NotificationConfig(
        config_id=uuid.uuid4(),
        name=name,
        description=None,
        channels=[],
        enabled=True,
        created_at=now_utc(),
        last_triggered_at=None,
        trigger_count=0,
    )
    cache.set(f"config:{cfg.config_id}", cfg.to_dict())
    return cfg


def test_update_config_failed_persist_propagates_and_keeps_cache_consistent():
    cache = MetricCache()
    db = _RaisingSettingsDB()
    repo = NotificationRepository(cache, db)
    cfg = _seed_config(cache, name="original")

    with pytest.raises(RuntimeError):
        repo.update_config(cfg.config_id, NotificationConfigUpdate(name="updated"))

    assert db.write_calls == 1
    # Cache must not hold the new value ahead of the failed DB write.
    assert cache.get(f"config:{cfg.config_id}")["name"] == "original"


def test_update_config_success_writes_db_then_cache():
    cache = MetricCache()
    db = _OkSettingsDB()
    repo = NotificationRepository(cache, db)
    cfg = _seed_config(cache, name="original")

    updated = repo.update_config(cfg.config_id, NotificationConfigUpdate(name="updated"))

    assert updated is not None and updated.name == "updated"
    assert db.written[str(cfg.config_id)]["name"] == "updated"
    assert cache.get(f"config:{cfg.config_id}")["name"] == "updated"


def test_update_config_success_is_durable_across_cache_flush():
    # The actual #12 symptom was a silent revert on restart. After a flush,
    # reads fall back to the DB and must return the updated value.
    cache = MetricCache()
    db = _OkSettingsDB()
    repo = NotificationRepository(cache, db)
    cfg = _seed_config(cache, name="original")

    repo.update_config(cfg.config_id, NotificationConfigUpdate(name="updated"))

    cache.delete(f"config:{cfg.config_id}")
    reloaded = repo.get_config(cfg.config_id)
    assert reloaded is not None and reloaded.name == "updated"


def test_update_config_failed_persist_does_not_mutate_cached_channels():
    # channels is the one nested-list field; a failed update must not rebind
    # it on the cached dict (guards the dict(data) shallow copy).
    cache = MetricCache()
    db = _RaisingSettingsDB()
    repo = NotificationRepository(cache, db)
    cfg = _seed_config(cache, name="original")
    new_channel = uuid.uuid4()

    with pytest.raises(RuntimeError):
        repo.update_config(cfg.config_id, NotificationConfigUpdate(channels=[new_channel]))

    assert cache.get(f"config:{cfg.config_id}")["channels"] == []
