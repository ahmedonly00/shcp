"""Request validation helpers."""
from __future__ import annotations

from typing import Any


MAX_TEXT_LENGTH = 2_000
MIN_TEXT_LENGTH = 3
SUPPORTED_LANGUAGES = {"rw", "en", "fr"}


def validate_analyze_request(data: dict[str, Any]) -> list[str]:
    """
    Validate the POST /analyze payload.
    Returns a list of error strings (empty = valid).
    """
    errors: list[str] = []

    text = data.get("symptom_text", "")
    if not isinstance(text, str):
        errors.append("symptom_text must be a string")
    elif len(text.strip()) < MIN_TEXT_LENGTH:
        errors.append(
            f"symptom_text must be at least {MIN_TEXT_LENGTH} characters long"
        )
    elif len(text) > MAX_TEXT_LENGTH:
        errors.append(
            f"symptom_text must not exceed {MAX_TEXT_LENGTH} characters"
        )

    lang = data.get("language")
    if lang is not None:
        if not isinstance(lang, str) or lang not in SUPPORTED_LANGUAGES:
            errors.append(
                f"language must be one of: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
            )

    body_map = data.get("body_map_data")
    if body_map is not None and not isinstance(body_map, dict):
        errors.append("body_map_data must be an object")

    return errors
