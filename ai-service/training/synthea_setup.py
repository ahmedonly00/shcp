"""
synthea_setup.py
----------------
Downloads the Synthea JAR from GitHub and generates synthetic patient data.

Usage:
  python training/synthea_setup.py              # generate 5000 patients (default)
  python training/synthea_setup.py --patients 20000
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys

import requests

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNTHEA_DIR = os.path.join(BASE_DIR, "data", "synthea")
JAR_PATH    = os.path.join(SYNTHEA_DIR, "synthea-with-dependencies.jar")
OUTPUT_DIR  = os.path.join(SYNTHEA_DIR, "output")

_GITHUB_API = "https://api.github.com/repos/synthetichealth/synthea/releases/latest"


def _download_jar() -> None:
    """Download the latest Synthea JAR if not already present."""
    if os.path.exists(JAR_PATH):
        print(f"Synthea JAR already present: {JAR_PATH}")
        return

    os.makedirs(SYNTHEA_DIR, exist_ok=True)
    print("Fetching latest Synthea release info...")
    try:
        meta = requests.get(_GITHUB_API, timeout=15).json()
    except Exception as exc:
        sys.exit(f"Could not reach GitHub API: {exc}")

    tag = meta.get("tag_name", "unknown")
    asset = next(
        (a for a in meta.get("assets", []) if "with-dependencies" in a["name"]),
        None,
    )
    if not asset:
        sys.exit("Could not find synthea-with-dependencies.jar in latest release assets.")

    url = asset["browser_download_url"]
    size_mb = asset.get("size", 0) / 1_048_576
    print(f"Downloading Synthea {tag} ({size_mb:.0f} MB) ...")

    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        downloaded = 0
        with open(JAR_PATH, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
                downloaded += len(chunk)
                pct = downloaded / asset["size"] * 100 if asset.get("size") else 0
                print(f"\r  {pct:.0f}%  ({downloaded / 1_048_576:.1f} MB)", end="", flush=True)
    print(f"\nSaved: {JAR_PATH}")


def _write_properties() -> str:
    """Write a synthea.properties file that enables CSV export."""
    props_path = os.path.join(SYNTHEA_DIR, "synthea.properties")
    props = (
        "exporter.csv.export = true\n"
        "exporter.baseDirectory = " + OUTPUT_DIR.replace("\\", "/") + "\n"
        "generate.only_dead_patients = false\n"
        "generate.append_numbers_after_populating_column = false\n"
    )
    with open(props_path, "w") as f:
        f.write(props)
    return props_path


def run(n_patients: int = 5000) -> str:
    """
    Download Synthea (if needed) and generate n_patients synthetic patients.
    Returns the path to the CSV output directory.
    """
    _download_jar()
    props_path = _write_properties()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"\nGenerating {n_patients:,} synthetic patients...")
    print("(This takes 1-5 minutes — Synthea builds full patient histories)\n")

    cmd = [
        "java", "-jar", JAR_PATH,
        f"--exporter.baseDirectory={OUTPUT_DIR}",
        f"-c", props_path,
        "-p", str(n_patients),
    ]

    result = subprocess.run(cmd, cwd=SYNTHEA_DIR, capture_output=False)
    if result.returncode != 0:
        sys.exit(f"Synthea exited with code {result.returncode}")

    csv_dir = os.path.join(OUTPUT_DIR, "csv")
    conditions_path = os.path.join(csv_dir, "conditions.csv")
    if os.path.exists(conditions_path):
        import pandas as pd
        n = len(pd.read_csv(conditions_path))
        print(f"\nSynthea complete — {n:,} condition records written to {csv_dir}")
    else:
        print(f"\nSynthea complete. CSV output in: {csv_dir}")

    return csv_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download and run Synthea")
    parser.add_argument("--patients", type=int, default=5000,
                        help="Number of synthetic patients to generate (default: 5000)")
    args = parser.parse_args()
    run(args.patients)
    print("\nNext step: python training/synthea_converter.py")
