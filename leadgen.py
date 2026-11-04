#!/usr/bin/env python3
"""
Simple Executive Dialer & Lead Manager Local Server
Run with: python3 leadgen.py
Opens at: http://127.0.0.1:5000
"""

import os
import csv
import json
from flask import Flask, send_from_directory, request, jsonify

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(APP_DIR, "Data")
CSV_PATH = os.path.join(DATA_DIR, "data.csv")

os.makedirs(DATA_DIR, exist_ok=True)

CSV_HEADERS = [
    "company", "name", "phone", "email",
    "city", "street_address", "stage", "notes"
]

# Ensure Data/data.csv exists with seed records
if not os.path.exists(CSV_PATH) or os.path.getsize(CSV_PATH) == 0:
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerow({
            "company": "6ix Dispensary",
            "name": "Store Manager",
            "phone": "+1 (647) 222-7770",
            "email": "admin@6ixdispensary.com",
            "city": "Toronto",
            "street_address": "863 Bloor St W",
            "stage": "Fresh",
            "notes": "Bloorcourt location"
        })
        writer.writerow({
            "company": "Civil Liberties",
            "name": "Bar Lead",
            "phone": "+1 (416) 546-5634",
            "email": "info@civillibertiesbar.com",
            "city": "Toronto",
            "street_address": "878 Bloor St W",
            "stage": "Fresh",
            "notes": "Award-winning cocktail space"
        })
        writer.writerow({
            "company": "BarHop Brewco",
            "name": "Manager",
            "phone": "+1 (647) 352-7467",
            "email": "beer@barhopbar.com",
            "city": "Toronto",
            "street_address": "137 Peter St",
            "stage": "Fresh",
            "notes": "Large draught selection"
        })

app = Flask(__name__, static_folder=APP_DIR)

@app.route("/")
def index():
    return send_from_directory(APP_DIR, "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(APP_DIR, path)

@app.route("/api/leads", methods=["GET"])
def get_leads():
    leads = []
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                item = {h: (row.get(h) or "").strip() for h in CSV_HEADERS}
                item["id"] = str(i + 1)
                leads.append(item)
    return jsonify(leads)

@app.route("/api/leads", methods=["POST"])
def save_leads():
    leads = request.get_json() or []
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()
        for lead in leads:
            row = {h: lead.get(h, "").strip() for h in CSV_HEADERS}
            writer.writerow(row)
    return jsonify({"status": "ok", "count": len(leads)})

if __name__ == "__main__":
    print("\n" + "="*50)
    print(" DIALER RUNNING ON: http://127.0.0.1:5000")
    print(f" DATA FILE: {CSV_PATH}")
    print("="*50 + "\n")
    app.run(host="127.0.0.1", port=5000, debug=True)