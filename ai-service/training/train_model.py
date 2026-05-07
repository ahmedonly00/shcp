"""
train_model.py
--------------
Trains a RandomForestClassifier on the deduplicated symptom dataset,
then wraps it with Platt-scaling calibration so confidence scores
reflect realistic probabilities rather than raw vote fractions.

Augmentation strategy — dropout augmentation for binary symptom vectors:
  For each training sample we generate several masked variants by randomly
  zeroing out a fraction of the active (1-valued) symptom flags.  This
  teaches the forest to be confident even when a patient reports only a
  subset of the canonical symptom pattern, which is the main cause of
  LOW_CONFIDENCE predictions in production.

  SMOTE was evaluated and rejected: interpolating binary features produces
  fractional values that blur disease boundaries, dropping test accuracy
  from 100% to 95% and average confidence from 78.8% to 73.7%.

Calibration strategy — Platt scaling (sigmoid) with cv='prefit':
  After dropout-augmented training the raw RF confidences are inflated
  (avg ~98% on the test set).  CalibratedClassifierCV with method='sigmoid'
  fits a per-class sigmoid transform on the original (non-augmented) training
  data so the reported confidence better reflects the model's real uncertainty.
  The raw RF is also saved separately so SHAP TreeExplainer can still use it
  (calibrated wrappers are not directly supported by SHAP).

Saves:
  models/disease_classifier.pkl        — calibrated model (used for predictions)
  models/disease_classifier_base.pkl   — raw RandomForest (used for SHAP)
  models/model_version.json            — version metadata (read by predictor.py)
"""
import json
import os
import pickle
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
try:
    from sklearn.frozen import FrozenEstimator   # sklearn 1.6+
    _has_frozen = True
except ImportError:
    _has_frozen = False
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import LabelEncoder

BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_MERGED_PATH  = os.path.join(BASE_DIR, "data", "merged", "combined.csv")
_DEFAULT_PATH = os.path.join(BASE_DIR, "data", "raw", "symbipredict_2022.csv")
# Use the merged multi-source dataset when available (run training/data_pipeline.py first)
DATA_PATH     = _MERGED_PATH if os.path.exists(_MERGED_PATH) else _DEFAULT_PATH
MODELS_DIR    = os.path.join(BASE_DIR, "models")

# Bump this string each time the model is retrained with structural changes.
_MODEL_VERSION = "RandomForest-v3-calibrated"

_DROPOUT_RATES = [0.10, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.70, 0.80, 0.85]


def _augment(X: np.ndarray, y: np.ndarray, rng: np.random.Generator) -> tuple:
    """Return (X_aug, y_aug) with one masked variant per dropout rate."""
    aug_X, aug_y = [X], [y]
    for rate in _DROPOUT_RATES:
        X_copy = X.copy().astype(float)
        for i in range(len(X_copy)):
            active_idx = np.where(X_copy[i] == 1)[0]
            if len(active_idx) == 0:
                continue
            n_drop   = max(1, int(len(active_idx) * rate))
            drop_idx = rng.choice(active_idx, size=n_drop, replace=False)
            X_copy[i, drop_idx] = 0
        aug_X.append(X_copy)
        aug_y.append(y)
    return np.vstack(aug_X), np.concatenate(aug_y)


def train() -> None:
    rng = np.random.default_rng(42)

    # ── load & dedup ────────────────────────────────────────────────────────────
    print(f"\nDataset : {DATA_PATH}")
    df = pd.read_csv(DATA_PATH).drop_duplicates()
    print(f"          {len(df)} rows | {df['prognosis'].nunique()} diseases")

    feature_cols = [c for c in df.columns if c != "prognosis"]
    X  = df[feature_cols].values
    le = LabelEncoder()
    y  = le.fit_transform(df["prognosis"])

    # ── split ───────────────────────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # ── dropout augmentation on training split only ─────────────────────────────
    X_train_aug, y_train_aug = _augment(X_train, y_train, rng)
    print(
        f"\nTraining samples : {len(y_train)} -> {len(y_train_aug)} "
        f"(dropout augmentation, {len(_DROPOUT_RATES)} copies/sample)"
    )

    # ── train ───────────────────────────────────────────────────────────────────
    # max_depth=25 caps tree depth so models stay under ~200 MB each.
    # Without a limit, 120k+ augmented rows produce 10+ GB trees that
    # exceed typical server RAM and cause SHAP allocation failures.
    clf = RandomForestClassifier(
        n_estimators=300,
        max_depth=25,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_train_aug, y_train_aug)

    # ── Platt-scaling calibration (FrozenEstimator on sklearn 1.6+, cv='prefit' otherwise) ──
    # Fit the sigmoid transform on the original (non-augmented) training data.
    if _has_frozen:
        calibrated = CalibratedClassifierCV(FrozenEstimator(clf), method="sigmoid")
    else:
        calibrated = CalibratedClassifierCV(clf, method="sigmoid", cv="prefit")
    calibrated.fit(X_train, y_train)

    # ── evaluate on original (non-augmented) test set ───────────────────────────
    test_acc  = calibrated.score(X_test, y_test)
    cv_scores = cross_val_score(clf, X, y, cv=5, scoring="accuracy")

    raw_proba  = clf.predict_proba(X_test).max(axis=1)
    cal_proba  = calibrated.predict_proba(X_test).max(axis=1)
    avg_conf   = cal_proba.mean() * 100
    below_50   = (cal_proba < 0.5).sum()
    below_60   = (cal_proba < 0.6).sum()

    print(f"\n{'='*60}")
    print(f"  Test accuracy    : {test_acc:.4f}")
    print(f"  5-fold CV mean   : {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")
    print(f"  Raw avg conf     : {raw_proba.mean()*100:.2f}%  (pre-calibration)")
    print(f"  Cal avg conf     : {avg_conf:.2f}%  (post-calibration)")
    print(f"  < 50% confidence : {below_50} ({below_50/len(y_test)*100:.1f}%)")
    print(f"  < 60% confidence : {below_60} ({below_60/len(y_test)*100:.1f}%)")
    print(f"{'='*60}\n")

    y_pred = calibrated.predict(X_test)
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    importances = clf.feature_importances_
    top10_idx   = np.argsort(importances)[-10:][::-1]
    print("\nTop-10 most important features:")
    for i, idx in enumerate(top10_idx, 1):
        print(f"  {i:>2}. {feature_cols[idx]:<40} {importances[idx]:.4f}")

    # ── save models ─────────────────────────────────────────────────────────────
    os.makedirs(MODELS_DIR, exist_ok=True)

    # Calibrated model — used by predictor.py for predict_proba()
    model_path = os.path.join(MODELS_DIR, "disease_classifier.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(calibrated, f)
    print(f"\nCalibrated model saved -> {model_path}")

    # Raw RF — used by predictor.py for SHAP TreeExplainer (calibrated wrappers unsupported)
    base_path = os.path.join(MODELS_DIR, "disease_classifier_base.pkl")
    with open(base_path, "wb") as f:
        pickle.dump(clf, f)
    print(f"Base RF saved        -> {base_path}")

    # Label encoder — always re-saved so its sklearn version matches the model
    le_path = os.path.join(MODELS_DIR, "label_encoder.pkl")
    with open(le_path, "wb") as f:
        pickle.dump(le, f)
    print(f"Label encoder saved  -> {le_path}")

    # ── save version metadata ───────────────────────────────────────────────────
    top10_features = [
        {"feature": feature_cols[idx], "importance": round(float(importances[idx]), 6)}
        for idx in top10_idx
    ]
    meta = {
        "version":              _MODEL_VERSION,
        "trained_at":           datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "algorithm":            "RandomForestClassifier + Platt scaling",
        "calibration":          "sigmoid (cv=prefit)",
        "n_estimators":         300,
        "n_diseases":           int(len(le.classes_)),
        "n_symptoms":           int(len(feature_cols)),
        "training_samples":     int(len(y_train_aug)),
        "test_accuracy":        round(float(test_acc), 6),
        "cv_mean":              round(float(cv_scores.mean()), 6),
        "avg_confidence_raw":   round(float(raw_proba.mean() * 100), 2),
        "avg_confidence":       round(float(avg_conf), 2),
        "top10_features":       top10_features,
    }
    version_path = os.path.join(MODELS_DIR, "model_version.json")
    with open(version_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Version metadata saved -> {version_path}")


if __name__ == "__main__":
    train()
