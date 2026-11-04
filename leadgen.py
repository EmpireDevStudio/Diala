#!/usr/bin/env python3
"""
Executive Tele-Dialer & Lead Discovery Local Server
===================================================
- Automatically scans the Data/ directory for all CSV files (any filename).
- Serves the unified Off-White Editorial Web Workstation.
- Provides endpoints to read, append, update, and persist lists to disk.
- Run with: python3 app.py
"""

import os
import sys
import csv
import json
import socket
import logging
from typing import List, Dict, Any
from flask import Flask, send_from_directory, request, jsonify, Response

# ---------------------------------------------------------------------------
# Logging & Paths Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("ExecutiveDialer")

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(APP_DIR, "Data")
os.makedirs(DATA_DIR, exist_ok=True)

CSV_COLUMNS: List[str] = [
    "name",
    "phone",
    "email",
    "country",
    "city",
    "street_address",
    "postal_code",
    "company",
    "job_title",
    "website",
    "stage",
    "notes"
]

DEFAULT_CSV_PATH = os.path.join(DATA_DIR, "data.csv")

# Ensure an initial data.csv exists with standard header if folder is empty
if not os.path.exists(DEFAULT_CSV_PATH):
    with open(DEFAULT_CSV_PATH, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerow({
            "name": "Store Manager",
            "phone": "+1 (647) 222-7770",
            "email": "admin@6ixdispensary.com",
            "country": "Canada",
            "city": "Toronto",
            "street_address": "863 Bloor St W",
            "postal_code": "M6G 1M2",
            "company": "6ix Dispensary",
            "job_title": "Manager",
            "website": "https://6ixdispensary.com",
            "stage": "uncontacted",
            "notes": "Verified in Toronto (Cannabis Dispensary)"
        })
        writer.writerow({
            "name": "Beverage Director",
            "phone": "+1 (416) 546-5634",
            "email": "info@civillibertiesbar.com",
            "country": "Canada",
            "city": "Toronto",
            "street_address": "878 Bloor St W",
            "postal_code": "M6G 1M5",
            "company": "Civil Liberties",
            "job_title": "Proprietor",
            "website": "https://civillibertiesbar.com",
            "stage": "uncontacted",
            "notes": "Verified in Toronto (Cocktail Bars)"
        })

app = Flask(__name__, static_folder=APP_DIR)

# ---------------------------------------------------------------------------
# Static Web Serving Routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(APP_DIR, "index.html")

@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory(APP_DIR, filename)

@app.route("/Data/<path:filename>")
def serve_data_file(filename):
    return send_from_directory(DATA_DIR, filename)

# ---------------------------------------------------------------------------
# Dynamic Data/ Folder API Endpoints
# ---------------------------------------------------------------------------
@app.route("/api/lists", methods=["GET"])
def get_all_lists():
    """
    Scans the Data/ folder and returns all .csv filenames regardless of how they are named.
    """
    try:
        csv_files = [f for f in os.listdir(DATA_DIR) if f.lower().endswith(".csv")]
        if "data.csv" in csv_files:
            csv_files.remove("data.csv")
            csv_files.insert(0, "data.csv")
        return jsonify(csv_files)
    except Exception as e:
        logger.error(f"Error scanning Data/ folder: {e}")
        return jsonify([]), 500

@app.route("/api/load", methods=["GET"])
def load_list_data():
    """
    Reads any requested CSV file from the Data/ directory and returns normalized records.
    """
    filename = request.args.get("file", "data.csv").strip()
    # Strip any directory traversal
    filename = os.path.basename(filename)
    if not filename.endswith(".csv"):
        filename += ".csv"

    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": f"File '{filename}' not found in Data/"}), 404

    records = []
    try:
        with open(filepath, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            fieldnames = [fn.lower().strip() for fn in (reader.fieldnames or [])]
            for idx, row in enumerate(reader):
                cleaned_row: Dict[str, str] = {}
                for col in CSV_COLUMNS:
                    # Case-insensitive match on columns
                    val = ""
                    for k, v in row.items():
                        if k and k.lower().strip() == col:
                            val = v or ""
                            break
                    cleaned_row[col] = val.strip()

                if not cleaned_row.get("company") and not cleaned_row.get("phone"):
                    continue

                cleaned_row["id"] = f"srv_{idx}_{abs(hash(cleaned_row.get('company', '')))}"
                records.append(cleaned_row)

        return jsonify({
            "file": filename,
            "count": len(records),
            "records": records
        })
    except Exception as e:
        logger.error(f"Error reading {filename}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/save", methods=["POST"])
def save_list_data():
    """
    Saves or appends records directly into a target CSV file inside Data/.
    """
    payload = request.get_json() or {}
    filename = payload.get("file", "leads_export.csv").strip()
    filename = os.path.basename(filename)
    if not filename.endswith(".csv"):
        filename += ".csv"

    records = payload.get("records", [])
    if not isinstance(records, list):
        return jsonify({"error": "Invalid records payload"}), 400

    filepath = os.path.join(DATA_DIR, filename)
    temp_path = filepath + ".tmp"

    try:
        with open(temp_path, mode="w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            for r in records:
                row_dict = {col: str(r.get(col, "")).strip() for col in CSV_COLUMNS}
                writer.writerow(row_dict)

        # Atomic move to prevent partial writes
        os.replace(temp_path, filepath)
        logger.info(f"Persisted {len(records)} leads to Data/{filename}")
        return jsonify({"status": "saved", "file": filename, "count": len(records)})
    except Exception as e:
        logger.error(f"Error saving {filename}: {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": str(e)}), 500

@app.route("/api/download", methods=["GET"])
def download_list():
    """
    Direct browser download of any CSV list from the Data/ folder.
    """
    filename = request.args.get("file", "data.csv").strip()
    filename = os.path.basename(filename)
    filepath = os.path.join(DATA_DIR, filename)

    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404

    return send_from_directory(
        DATA_DIR,
        filename,
        as_attachment=True,
        mimetype="text/csv"
    )

# ---------------------------------------------------------------------------
# CLI Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = 5050
    print("\n" + "=" * 70)
    print(" EXECUTIVE TELE-DIALER & LEADGEN LOCAL WORKSTATION")
    print("=" * 70)
    print(f" Web Root:       {APP_DIR}")
    print(f" Data Directory: {DATA_DIR}")
    print(f" Active URL:     http://127.0.0.1:{port}")
    print("=" * 70 + "\n")

    app.run(host="127.0.0.1", port=port, debug=True)