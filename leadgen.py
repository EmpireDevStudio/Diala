#!/usr/bin/env python3
"""
Local Backend Bridge & Prospecting Synchronization Server
Serves the web application and synchronizes Data/*.csv files locally.
"""

import os
import csv
import json
from flask import Flask, send_from_directory, request, jsonify, Response

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(APP_DIR, "Data")
os.makedirs(DATA_DIR, exist_ok=True)

app = Flask(__name__, static_folder=APP_DIR)

CSV_COLUMNS = [
    "name", "phone", "email", "country", "city",
    "street_address", "postal_code", "company",
    "job_title", "website", "stage", "notes"
]

@app.route("/")
def index():
    return send_from_directory(APP_DIR, "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(APP_DIR, filename)

@app.route("/api/lists", methods=["GET"])
def list_csv_files():
    """Lists all .csv files found inside the Data/ folder."""
    files = [f for f in os.listdir(DATA_DIR) if f.lower().endswith(".csv")]
    return jsonify(sorted(files))

@app.route("/api/load_list", methods=["GET"])
def load_list():
    """Loads a specific CSV file from the Data/ folder."""
    filename = request.args.get("file", "data.csv")
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": f"File {filename} not found"}), 404

    records = []
    with open(filepath, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            rec = {k: (row.get(k) or "").strip() for k in CSV_COLUMNS}
            rec["id"] = f"srv_{idx}_{hash(rec['company'])}"
            records.append(rec)

    return jsonify({"file": filename, "records": records})

@app.route("/api/save_list", methods=["POST"])
def save_list():
    """Saves records into a CSV file in the Data/ directory."""
    payload = request.get_json() or {}
    filename = payload.get("file", "data.csv")
    records = payload.get("records", [])

    if not filename.endswith(".csv"):
        filename += ".csv"

    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for r in records:
            writer.writerow({k: r.get(k, "") for k in CSV_COLUMNS})

    return jsonify({"status": "saved", "file": filename, "count": len(records)})

if __name__ == "__main__":
    print("\n" + "=" * 65)
    print(" EXECUTIVE TELE-DIALER & LEADGEN LOCAL SERVER")
    print(f" Web App Root:    {APP_DIR}")
    print(f" Data Directory:  {DATA_DIR}")
    print(" Access URL:      http://127.0.0.1:5050")
    print("=" * 65 + "\n")
    app.run(host="127.0.0.1", port=5050, debug=True)