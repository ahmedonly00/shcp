"""Prediction audit log — persists every /analyze result to SQLite."""
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


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(_DDL)
    conn.commit()
    return conn


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
        conn = _connect()
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
        conn.close()
    except Exception as exc:
        logger.warning("Prediction logging failed: %s", exc)


def prediction_stats() -> dict:
    """Return aggregate counts from the audit log for the health endpoint."""
    try:
        conn = _connect()
        cur = conn.execute("SELECT COUNT(*) FROM predictions")
        total = cur.fetchone()[0]
        cur = conn.execute(
            "SELECT urgency, COUNT(*) FROM predictions GROUP BY urgency"
        )
        by_urgency = dict(cur.fetchall())
        conn.close()
        return {"total_predictions": total, "by_urgency": by_urgency}
    except Exception:
        return {}
