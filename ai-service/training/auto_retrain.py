"""
auto_retrain.py
---------------
Orchestrates the full retraining pipeline when enough confirmed feedback has
accumulated since the last training run.

Pipeline:
  1. feedback_export.py  → data/raw/feedback_confirmed.csv
  2. data_pipeline.py    → data/merged/combined.csv
  3. train_model.py      → models/disease_classifier.pkl

Usage:
  python training/auto_retrain.py                     # retrain if >= 50 new rows
  python training/auto_retrain.py --min-rows 25        # custom threshold
  python training/auto_retrain.py --force              # skip threshold, always retrain
  python training/auto_retrain.py --dry-run            # show what would happen, no changes
  python training/auto_retrain.py --skip-feedback      # skip export step (use existing CSV)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

BASE_DIR       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RETRAIN_LOG    = os.path.join(BASE_DIR, "models", "retrain_log.json")
COMBINED_CSV   = os.path.join(BASE_DIR, "data", "merged", "combined.csv")
FEEDBACK_CSV   = os.path.join(BASE_DIR, "data", "raw", "feedback_confirmed.csv")


# ── Retrain log helpers ────────────────────────────────────────────────────────

def _load_log() -> dict:
    if os.path.exists(RETRAIN_LOG):
        with open(RETRAIN_LOG) as f:
            return json.load(f)
    return {"runs": [], "total_feedback_rows_exported": 0}


def _save_log(log: dict) -> None:
    os.makedirs(os.path.dirname(RETRAIN_LOG), exist_ok=True)
    with open(RETRAIN_LOG, "w") as f:
        json.dump(log, f, indent=2)


def _last_run_info(log: dict) -> dict | None:
    return log["runs"][-1] if log.get("runs") else None


# ── Pipeline steps ─────────────────────────────────────────────────────────────

def _step_feedback_export(dry_run: bool) -> int:
    """
    Export confirmed feedback rows to feedback_confirmed.csv.
    Returns the number of rows exported (0 if none or DB unreachable).
    """
    print("\n" + "="*60)
    print("STEP 1/3 — Export confirmed feedback")
    print("="*60)

    # Import here to avoid circular startup overhead
    sys.path.insert(0, BASE_DIR)
    from training.feedback_export import export
    return export(out_path=FEEDBACK_CSV, dry_run=dry_run)


def _step_data_pipeline(dry_run: bool) -> str:
    """Merge all raw CSVs into combined.csv. Returns output path."""
    print("\n" + "="*60)
    print("STEP 2/3 — Rebuild merged dataset")
    print("="*60)

    if dry_run:
        print("Dry-run — skipping data_pipeline.")
        return COMBINED_CSV

    sys.path.insert(0, BASE_DIR)
    from training.data_pipeline import build
    return build()


def _step_train_model(dry_run: bool) -> None:
    """Retrain the RandomForest classifier."""
    print("\n" + "="*60)
    print("STEP 3/3 — Train model")
    print("="*60)

    if dry_run:
        print("Dry-run — skipping train_model.")
        return

    sys.path.insert(0, BASE_DIR)
    from training.train_model import train
    train()


# ── New-rows check ─────────────────────────────────────────────────────────────

def _count_new_feedback_rows(log: dict) -> int:
    """
    Count confirmed feedback rows in the DB that haven't been exported yet,
    based on total rows at last export vs current DB count.
    Falls back to checking if feedback_confirmed.csv changed.
    """
    sys.path.insert(0, BASE_DIR)
    from training.feedback_export import count as db_count
    total_in_db = db_count()

    previously_exported = log.get("total_feedback_rows_exported", 0)
    new_rows = max(0, total_in_db - previously_exported)
    print(f"Confirmed feedback in DB : {total_in_db}")
    print(f"Exported at last run     : {previously_exported}")
    print(f"New rows since last run  : {new_rows}")
    return new_rows


# ── Main ───────────────────────────────────────────────────────────────────────

def run(
    min_rows: int     = 50,
    force: bool       = False,
    dry_run: bool     = False,
    skip_feedback: bool = False,
) -> None:
    log = _load_log()
    last = _last_run_info(log)

    print(f"\nAuto-retrain check — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    if last:
        print(f"Last retrain : {last.get('trained_at', 'unknown')}  "
              f"({last.get('feedback_rows', 0)} feedback rows at that time)")
    else:
        print("Last retrain : never")

    # ── Decide whether to retrain ──────────────────────────────────────────────
    if force:
        print(f"\n--force flag set — skipping threshold check")
        should_retrain = True
    elif skip_feedback:
        # When feedback is skipped we always proceed (user knows what they're doing)
        should_retrain = True
    else:
        new_rows = _count_new_feedback_rows(log)
        if new_rows < min_rows:
            print(f"\nNot enough new feedback ({new_rows} < {min_rows}). "
                  f"Run with --force to override, or wait for more patient feedback.")
            return
        print(f"\n{new_rows} new rows >= threshold {min_rows} — proceeding with retraining.")
        should_retrain = True

    if not should_retrain:
        return

    # ── Run pipeline ───────────────────────────────────────────────────────────
    feedback_rows_exported = 0

    if not skip_feedback:
        feedback_rows_exported = _step_feedback_export(dry_run)
        if feedback_rows_exported == 0 and not force:
            print("\nNo feedback rows exported — aborting retraining.")
            print("Use --skip-feedback to retrain on existing data, or --force to proceed anyway.")
            return

    _step_data_pipeline(dry_run)
    _step_train_model(dry_run)

    if dry_run:
        print("\nDry-run complete — no files were modified.")
        return

    # ── Update log ─────────────────────────────────────────────────────────────
    run_record = {
        "trained_at":    datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "feedback_rows": feedback_rows_exported,
        "forced":        force,
    }
    log["runs"].append(run_record)
    log["total_feedback_rows_exported"] = (
        log.get("total_feedback_rows_exported", 0) + feedback_rows_exported
    )
    _save_log(log)
    print(f"\nRetrain log updated -> {RETRAIN_LOG}")
    print("\nRetraining complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Retrain the AI model when enough new feedback has accumulated"
    )
    parser.add_argument("--min-rows",       type=int,  default=50,
                        help="Minimum new confirmed feedback rows needed to trigger retraining (default: 50)")
    parser.add_argument("--force",          action="store_true",
                        help="Retrain regardless of feedback count")
    parser.add_argument("--dry-run",        action="store_true",
                        help="Show what would happen without writing any files")
    parser.add_argument("--skip-feedback",  action="store_true",
                        help="Skip feedback export — retrain on existing data/raw/*.csv only")
    args = parser.parse_args()
    run(
        min_rows=args.min_rows,
        force=args.force,
        dry_run=args.dry_run,
        skip_feedback=args.skip_feedback,
    )
