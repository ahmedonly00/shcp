"""Prediction audit log — persists every /analyze result to SQLite.

A module-level singleton connection is opened once at import time and reused
for every insert and query.  ``check_same_thread=False`` is safe here because
Flask/Gunicorn routes are single-writer and WAL mode serialises concurrent
reads at the SQLite layer.
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "logs", "predictions.db",
)

_DDL = """
CREATE TABLE IF NOT EXISTS predictions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at        TEXT    NOT NULL,
    patient_id        TEXT,
    patient_age       INTEGER,
    patient_sex       TEXT,
    language          TEXT,
    symptom_text      TEXT,
    detected_symptoms TEXT,
    symptom_count     INTEGER,
    predicted_disease TEXT,
    icd10             TEXT,
    confidence        REAL,
    urgency           TEXT,
    pathway           TEXT,
    status            TEXT,
    severity_hint     TEXT,
    duration_hint     TEXT,
    model_version     TEXT
)
"""

# ── Module-level singleton connection ─────────────────────────────────────────

_conn: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    """Return the module-level connection, initialising it on first call."""
    global _conn
    if _conn is not None:
        return _conn
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    _conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.execute(_DDL)
    _conn.commit()
    return _conn


def log_prediction(
    *,
    patient_id: str | None,
    patient_age: int | None,
    patient_sex: str | None,
    language: str,
    symptom_text: str,
    result: dict,
    severity_hint: str | None,
    duration_hint: str | None,
) -> None:
    """Write one prediction record. Failures are logged, never raised."""
    try:
        conn = _get_conn()
        conn.execute(
            """
            INSERT INTO predictions (
                created_at, patient_id, patient_age, patient_sex,
                language, symptom_text, detected_symptoms, symptom_count,
                predicted_disease, icd10, confidence, urgency, pathway,
                status, severity_hint, duration_hint, model_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                patient_id,
                patient_age,
                patient_sex,
                language,
                symptom_text,
                json.dumps(result.get("detected_symptoms", [])),
                result.get("symptom_count"),
                result.get("disease"),
                result.get("icd10"),
                result.get("confidence"),
                result.get("urgency"),
                result.get("pathway"),
                result.get("status"),
                severity_hint,
                duration_hint,
                result.get("model_version"),
            ),
        )
        conn.commit()
    except Exception as exc:
        logger.warning("Prediction logging failed: %s", exc)


def prediction_stats() -> dict:
    """Return aggregate counts from the audit log for the health endpoint."""
    try:
        conn = _get_conn()
        cur = conn.execute("SELECT COUNT(*) FROM predictions")
        total = cur.fetchone()[0]
        cur = conn.execute(
            "SELECT urgency, COUNT(*) FROM predictions GROUP BY urgency"
        )
        by_urgency = dict(cur.fetchall())
        return {"total_predictions": total, "by_urgency": by_urgency}
    except Exception:
        return {}
