"""
AURELIUS — PROFESSIONAL CRM & LEAD GENERATION PLATFORM
Backend Application Server & API Engine
"""

import os
import re
import csv
import io
import time
import uuid
import socket
import zipfile
import tempfile
import threading
import ipaddress
from datetime import datetime
from urllib.parse import urlparse, urljoin
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load local environment configuration
load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "Data")
os.makedirs(DATA_DIR, exist_ok=True)

# ==============================================================================
# 1. SECURITY & UTILITY MODULE
# ==============================================================================

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

def is_safe_url(url: str) -> bool:
    """Validate whether an external URL is safe to fetch (SSRF prevention)."""
    if not url or not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        
        # Block localhost variants explicitly
        if hostname.lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return False
        
        # Resolve hostname to IP and check against blocked subnets
        try:
            ip_str = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip_str)
            for net in BLOCKED_IP_NETWORKS:
                if ip_obj in net:
                    return False
        except socket.error:
            return False
        
        return True
    except Exception:
        return False

def slugify(text: str) -> str:
    """Create a filesystem and URL-safe slug from input text."""
    if not text:
        return "general"
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "_", text)
    return text.strip("_") or "general"

def normalize_phone(phone_str: str) -> str:
    """Sanitize and format telephone numbers."""
    if not phone_str:
        return ""
    return re.sub(r"[^\d+extEXT\s\(\)-]", "", phone_str).strip()

def clean_email(email_str: str) -> str:
    """Validate and normalize an email address."""
    if not email_str:
        return ""
    email_str = email_str.strip().lower()
    email_regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if re.match(email_regex, email_str):
        if any(email_str.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]):
            return ""
        return email_str
    return ""

def calculate_lead_score(lead: dict) -> int:
    """Compute a transparent 0-100 quality score based on verified data completeness."""
    score = 0
    if lead.get("website"):
        score += 15
    if lead.get("business_email"):
        score += 25
        if lead.get("verification_status") in ("Verified", "High Confidence"):
            score += 10
    if lead.get("business_phone"):
        score += 15
    if lead.get("decision_maker_name"):
        score += 20
    if lead.get("decision_maker_title"):
        score += 5
    if lead.get("decision_maker_email"):
        score += 10
    return min(100, score)


# ==============================================================================
# 2. CSV MANAGER (ATOMIC PERSISTENCE & SCHEMA)
# ==============================================================================

SCHEMA_COLUMNS = [
    "id",
    "business_name",
    "profession",
    "city",
    "region",
    "country",
    "address",
    "business_email",
    "business_phone",
    "website",
    "place_id",
    "decision_maker_name",
    "decision_maker_title",
    "decision_maker_email",
    "decision_maker_phone",
    "data_source_urls",
    "data_confidence",
    "verification_status",
    "pipeline_stage",
    "priority",
    "lead_score",
    "notes",
    "tags",
    "suppressed",
    "suppression_reason",
    "date_added",
    "last_verified",
    "last_contacted",
    "next_followup"
]

class CSVManager:
    """Handles atomic read/writes for profession-specific CSVs in Data/."""
    def __init__(self, data_dir: str):
        self.data_dir = os.path.abspath(data_dir)
        os.makedirs(self.data_dir, exist_ok=True)

    def _get_filepath(self, profession_slug: str) -> str:
        safe_name = slugify(profession_slug) + ".csv"
        return os.path.join(self.data_dir, safe_name)

    def list_all_lists(self) -> List[Dict]:
        lists = []
        if not os.path.exists(self.data_dir):
            return lists

        for fname in sorted(os.listdir(self.data_dir)):
            if fname.endswith(".csv"):
                slug = fname[:-4]
                path = os.path.join(self.data_dir, fname)
                count = 0
                verified_count = 0
                try:
                    with open(path, mode="r", encoding="utf-8-sig") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            count += 1
                            if row.get("business_email") or row.get("verification_status") == "Verified":
                                verified_count += 1
                except Exception:
                    pass
                
                display_name = slug.replace("_", " ").title()
                lists.append({
                    "slug": slug,
                    "name": display_name,
                    "filename": fname,
                    "prospect_count": count,
                    "verified_count": verified_count,
                    "updated_at": datetime.fromtimestamp(os.path.getmtime(path)).isoformat()
                })
        return lists

    def read_list(self, profession_slug: str) -> List[Dict]:
        filepath = self._get_filepath(profession_slug)
        if not os.path.exists(filepath):
            return []
        
        leads = []
        with open(filepath, mode="r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                lead = {col: row.get(col, "") for col in SCHEMA_COLUMNS}
                lead["lead_score"] = int(lead.get("lead_score") or calculate_lead_score(lead))
                leads.append(lead)
        return leads

    def read_all_leads(self) -> List[Dict]:
        all_leads = []
        for meta in self.list_all_lists():
            all_leads.extend(self.read_list(meta["slug"]))
        return all_leads

    def write_list(self, profession_slug: str, leads: List[Dict]) -> bool:
        """Atomic file writing via temporary file replacement."""
        filepath = self._get_filepath(profession_slug)
        dir_name = os.path.dirname(filepath)
        
        fd, temp_path = tempfile.mkstemp(dir=dir_name, prefix="crm_tmp_", suffix=".csv")
        try:
            with open(fd, mode="w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=SCHEMA_COLUMNS, quoting=csv.QUOTE_MINIMAL)
                writer.writeheader()
                for lead in leads:
                    row = {col: lead.get(col, "") for col in SCHEMA_COLUMNS}
                    row["lead_score"] = str(calculate_lead_score(row))
                    writer.writerow(row)
            
            if os.path.exists(filepath):
                os.replace(temp_path, filepath)
            else:
                os.rename(temp_path, filepath)
            return True
        except Exception as e:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass
            raise e

    def append_leads(self, profession_slug: str, new_leads: List[Dict]) -> Tuple[int, int]:
        existing_leads = self.read_list(profession_slug)
        indexed = {}
        for lead in existing_leads:
            pid = lead.get("place_id")
            web = lead.get("website", "").lower().strip()
            name = lead.get("business_name", "").lower().strip()
            if pid:
                indexed[f"pid:{pid}"] = lead
            if web:
                indexed[f"web:{web}"] = lead
            if name:
                indexed[f"name:{name}"] = lead

        added = 0
        updated = 0

        for new_l in new_leads:
            if not new_l.get("id"):
                new_l["id"] = str(uuid.uuid4())
            if not new_l.get("date_added"):
                new_l["date_added"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            if not new_l.get("pipeline_stage"):
                new_l["pipeline_stage"] = "New"
            if not new_l.get("priority"):
                new_l["priority"] = "Medium"
            new_l["lead_score"] = calculate_lead_score(new_l)

            pid_key = f"pid:{new_l.get('place_id')}" if new_l.get("place_id") else None
            web_key = f"web:{new_l.get('website', '').lower().strip()}" if new_l.get("website") else None
            name_key = f"name:{new_l.get('business_name', '').lower().strip()}" if new_l.get("business_name") else None

            match = None
            if pid_key and pid_key in indexed:
                match = indexed[pid_key]
            elif web_key and web_key in indexed:
                match = indexed[web_key]
            elif name_key and name_key in indexed:
                match = indexed[name_key]

            if match:
                changed = False
                for field in ["business_email", "business_phone", "decision_maker_name", 
                              "decision_maker_title", "decision_maker_email", "decision_maker_phone", 
                              "address", "city", "place_id", "data_source_urls"]:
                    if not match.get(field) and new_l.get(field):
                        match[field] = new_l[field]
                        changed = True
                if changed:
                    match["last_verified"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
                    match["lead_score"] = calculate_lead_score(match)
                    updated += 1
            else:
                existing_leads.append(new_l)
                if pid_key:
                    indexed[pid_key] = new_l
                if web_key:
                    indexed[web_key] = new_l
                if name_key:
                    indexed[name_key] = new_l
                added += 1

        self.write_list(profession_slug, existing_leads)
        return added, updated


# ==============================================================================
# 3. GOOGLE PLACES API & 3×3 GRID PARTITIONING
# ==============================================================================

class GooglePlacesService:
    """Official Google Places API (New) & 3x3 geographical grid algorithm."""
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_PLACES_API_KEY", "").strip()

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def geocode_city(self, city_name: str) -> Optional[Dict]:
        if not self.is_configured():
            return self._mock_geocode(city_name)

        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": city_name, "key": self.api_key}
        try:
            resp = requests.get(url, params=params, timeout=10)
            data = resp.json()
            if data.get("status") == "OK" and len(data.get("results", [])) > 0:
                result = data["results"][0]
                geom = result["geometry"]
                viewport = geom.get("viewport", {
                    "northeast": {"lat": geom["location"]["lat"] + 0.05, "lng": geom["location"]["lng"] + 0.05},
                    "southwest": {"lat": geom["location"]["lat"] - 0.05, "lng": geom["location"]["lng"] - 0.05}
                })
                return {
                    "formatted_address": result.get("formatted_address", city_name),
                    "lat": geom["location"]["lat"],
                    "lng": geom["location"]["lng"],
                    "viewport": viewport
                }
        except Exception:
            pass
        return None

    def create_3x3_grid(self, viewport: Dict, expansion_factor: float = 1.20) -> List[Dict]:
        ne = viewport["northeast"]
        sw = viewport["southwest"]

        center_lat = (ne["lat"] + sw["lat"]) / 2.0
        center_lng = (ne["lng"] + sw["lng"]) / 2.0

        lat_span = (ne["lat"] - sw["lat"]) * expansion_factor
        lng_span = (ne["lng"] - sw["lng"]) * expansion_factor

        expanded_north = center_lat + (lat_span / 2.0)
        expanded_south = center_lat - (lat_span / 2.0)
        expanded_east = center_lng + (lng_span / 2.0)
        expanded_west = center_lng - (lng_span / 2.0)

        step_lat = (expanded_north - expanded_south) / 3.0
        step_lng = (expanded_east - expanded_west) / 3.0

        grid = []
        cell_num = 1
        for row in range(3):
            cell_north = expanded_north - (row * step_lat)
            cell_south = cell_north - step_lat
            for col in range(3):
                cell_west = expanded_west + (col * step_lng)
                cell_east = cell_west + step_lng
                grid.append({
                    "cell_id": cell_num,
                    "row": row,
                    "col": col,
                    "low": {"latitude": round(cell_south, 6), "longitude": round(cell_west, 6)},
                    "high": {"latitude": round(cell_north, 6), "longitude": round(cell_east, 6)},
                    "status": "Waiting",
                    "results_found": 0
                })
                cell_num += 1
        return grid

    def search_cell_businesses(self, profession: str, cell: Dict, page_token: Optional[str] = None) -> Tuple[List[Dict], Optional[str]]:
        if not self.is_configured():
            return self._mock_search_cell(profession, cell)

        url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,nextPageToken"
        }
        payload = {
            "textQuery": profession,
            "locationRestriction": {
                "rectangle": {
                    "low": cell["low"],
                    "high": cell["high"]
                }
            }
        }
        if page_token:
            payload["pageToken"] = page_token

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=12)
            if resp.status_code != 200:
                return [], None
            data = resp.json()
            places = data.get("places", [])
            next_token = data.get("nextPageToken")

            results = []
            for p in places:
                results.append({
                    "place_id": p.get("id", ""),
                    "business_name": p.get("displayName", {}).get("text", "Unknown Business"),
                    "address": p.get("formattedAddress", ""),
                    "website": p.get("websiteUri", ""),
                    "phone": p.get("nationalPhoneNumber", ""),
                    "google_maps_url": p.get("googleMapsUri", "")
                })
            return results, next_token
        except Exception:
            return [], None

    def _mock_geocode(self, city_name: str) -> Dict:
        base_coords = {
            "cardiff": (51.4816, -3.1791),
            "bristol": (51.4545, -2.5879),
            "newport": (51.5842, -2.9977),
            "swansea": (51.6214, -3.9436),
            "birmingham": (52.4862, -1.8904),
            "london": (51.5074, -0.1278),
            "manchester": (53.4808, -2.2426)
        }
        key = city_name.strip().lower()
        lat, lng = base_coords.get(key, (51.48, -3.18))
        return {
            "formatted_address": f"{city_name.title()}, UK",
            "lat": lat,
            "lng": lng,
            "viewport": {
                "northeast": {"lat": lat + 0.04, "lng": lng + 0.04},
                "southwest": {"lat": lat - 0.04, "lng": lng - 0.04}
            }
        }

    def _mock_search_cell(self, profession: str, cell: Dict) -> Tuple[List[Dict], Optional[str]]:
        cell_id = cell["cell_id"]
        results = []
        templates = [
            f"{profession.rstrip('s').title()} Express",
            f"Premier {profession.title()} Hub",
            f"Apex {profession.title()} & Co",
            f"Crown {profession.rstrip('s').title()} Services"
        ]
        count = (cell_id % 3) + 1
        for i in range(count):
            name_base = templates[(cell_id + i) % len(templates)]
            domain_base = name_base.lower().replace(" ", "").replace("&", "and")
            results.append({
                "place_id": f"ChIJ_DEMO_GRID_{cell_id}_{i}_{abs(hash(name_base)) % 10000}",
                "business_name": f"{name_base} Cell {cell_id}",
                "address": f"{10 + cell_id * 2} High Street, District {cell_id}",
                "website": f"https://www.{domain_base}-cell{cell_id}.co.uk",
                "phone": f"+44 20 {7946 + cell_id} {100 + i}",
                "google_maps_url": f"https://maps.google.com/?q={name_base}"
            })
        return results, None


# ==============================================================================
# 4. WEBSITE RESEARCH & CONTACT EXTRACTION CRAWLER
# ==============================================================================

class WebsiteResearcher:
    """SSRF-protected web crawler for email, phone, and decision-maker extraction."""
    def __init__(self, max_pages_per_site: int = 5, timeout: int = 8):
        self.max_pages_per_site = max_pages_per_site
        self.timeout = timeout
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AureliusBot/1.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }

    def research_business(self, website_url: str, target_titles: Optional[List[str]] = None) -> Dict:
        results = {
            "email": "",
            "phone": "",
            "decision_maker_name": "",
            "decision_maker_title": "",
            "decision_maker_email": "",
            "decision_maker_phone": "",
            "source_urls": [],
            "confidence": "Unverified",
            "status": "Requires Verification"
        }

        if not website_url or not is_safe_url(website_url):
            return results

        if not target_titles:
            target_titles = ["owner", "founder", "managing director", "director", "general manager", "operations manager"]
        target_titles_lower = [t.lower().strip() for t in target_titles if t]

        visited_urls = set()
        pages_to_visit = [website_url]
        extracted_emails = []
        extracted_phones = []

        try:
            home_html, final_url = self._fetch_page(website_url)
            if not home_html:
                return results

            visited_urls.add(final_url)
            results["source_urls"].append(final_url)

            sub_links = self._discover_subpages(home_html, final_url)
            for link in sub_links:
                if link not in visited_urls and len(pages_to_visit) < self.max_pages_per_site:
                    pages_to_visit.append(link)

            self._extract_from_html(home_html, final_url, extracted_emails, extracted_phones, results, target_titles_lower)

            for page_url in pages_to_visit[1:]:
                if len(visited_urls) >= self.max_pages_per_site:
                    break
                if page_url in visited_urls or not is_safe_url(page_url):
                    continue

                visited_urls.add(page_url)
                page_html, real_url = self._fetch_page(page_url)
                if page_html:
                    results["source_urls"].append(real_url)
                    self._extract_from_html(page_html, real_url, extracted_emails, extracted_phones, results, target_titles_lower)
                    if results["email"] and results["decision_maker_name"]:
                        break

            if extracted_emails and not results["email"]:
                results["email"] = extracted_emails[0]
            if extracted_phones and not results["phone"]:
                results["phone"] = extracted_phones[0]

            if results["email"]:
                results["confidence"] = "Verified from First-Party Website"
                results["status"] = "Verified"
            elif results["phone"]:
                results["confidence"] = "Found on First-Party Website"
                results["status"] = "Partially Verified"

        except Exception:
            pass

        return results

    def _fetch_page(self, url: str) -> Tuple[Optional[str], str]:
        if not is_safe_url(url):
            return None, url
        try:
            resp = requests.get(url, headers=self.headers, timeout=self.timeout, allow_redirects=True)
            if resp.status_code == 200 and is_safe_url(resp.url):
                content_type = resp.headers.get("Content-Type", "")
                if "text/html" in content_type or "application/xhtml" in content_type:
                    return resp.text, resp.url
        except Exception:
            pass
        return None, url

    def _discover_subpages(self, html: str, base_url: str) -> List[str]:
        soup = BeautifulSoup(html, "html.parser")
        parsed_base = urlparse(base_url)
        discovered = []

        keywords = ["contact", "about", "team", "staff", "leadership", "people", "management"]
        for a in soup.find_all("a", href=True):
            href = a.get("href", "").strip()
            anchor_text = a.get_text(separator=" ", strip=True).lower()
            full_url = urljoin(base_url, href)
            parsed_full = urlparse(full_url)

            if parsed_full.netloc.lower() == parsed_base.netloc.lower():
                path_lower = parsed_full.path.lower()
                if any(kw in path_lower or kw in anchor_text for kw in keywords):
                    if full_url not in discovered:
                        discovered.append(full_url)
        return discovered

    def _extract_from_html(self, html: str, page_url: str, emails_list: List[str], phones_list: List[str], 
                            results: Dict, target_titles: List[str]):
        soup = BeautifulSoup(html, "html.parser")

        for mailto in soup.select('a[href^="mailto:"]'):
            href = mailto.get("href", "")
            raw = href.replace("mailto:", "").split("?")[0]
            val = clean_email(raw)
            if val and val not in emails_list:
                emails_list.append(val)

        text_content = soup.get_text(separator=" ", strip=True)
        email_pattern = r"\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b"
        for match in re.findall(email_pattern, text_content):
            c = clean_email(match)
            if c and c not in emails_list:
                emails_list.append(c)

        for tel in soup.select('a[href^="tel:"]'):
            href = tel.get("href", "")
            raw = href.replace("tel:", "").split("?")[0]
            val = normalize_phone(raw)
            if val and val not in phones_list:
                phones_list.append(val)

        if not results["decision_maker_name"]:
            candidates = soup.find_all(["p", "div", "h2", "h3", "h4", "li", "span"])
            for el in candidates:
                txt = el.get_text(" ", strip=True)
                txt_lower = txt.lower()
                for title in target_titles:
                    if title in txt_lower and len(txt) < 140:
                        match_name = self._parse_name_near_title(txt, title)
                        if match_name:
                            results["decision_maker_name"] = match_name
                            results["decision_maker_title"] = title.title()
                            break
                if results["decision_maker_name"]:
                    break

    def _parse_name_near_title(self, text: str, title: str) -> Optional[str]:
        text = re.sub(r"\s+", " ", text).strip()
        parts = re.split(r"[-–—:|,]|\bis\b", text, flags=re.IGNORECASE)
        for part in parts:
            part_str = part.strip()
            if title not in part_str.lower():
                words = [w for w in part_str.split(" ") if w.isalpha() and len(w) > 1]
                if 2 <= len(words) <= 4:
                    if any(w[0].isupper() for w in words):
                        return " ".join(words)
        return None


# ==============================================================================
# 5. ASYNC LEAD FINDER JOB RUNNER
# ==============================================================================

class LeadFinderJobRunner:
    """Coordinates threaded 3x3 discovery runs across professions & cities."""
    def __init__(self, csv_mgr: CSVManager, places_svc: GooglePlacesService, researcher: WebsiteResearcher):
        self.csv_manager = csv_mgr
        self.places_service = places_svc
        self.researcher = researcher
        
        self.active_job: Optional[Dict] = None
        self.job_thread: Optional[threading.Thread] = None
        self._pause_event = threading.Event()
        self._pause_event.set()
        self._cancel_flag = False

    def get_status(self) -> Dict:
        if not self.active_job:
            return {"active": False, "job": None}
        return {
            "active": self.job_thread.is_alive() if self.job_thread else False,
            "paused": not self._pause_event.is_set(),
            "cancelled": self._cancel_flag,
            "job": self.active_job
        }

    def start_job(self, professions: List[str], cities: List[str], 
                  decision_maker_titles: List[str], expansion_factor: float = 1.20) -> Dict:
        if self.job_thread and self.job_thread.is_alive():
            raise RuntimeError("A research job is already running.")

        self._pause_event.set()
        self._cancel_flag = False

        job_id = str(uuid.uuid4())[:8]
        self.active_job = {
            "id": job_id,
            "start_time": datetime.utcnow().isoformat(),
            "professions": professions,
            "cities": cities,
            "decision_maker_titles": decision_maker_titles,
            "expansion_factor": expansion_factor,
            "current_profession": "",
            "current_city": "",
            "current_cell": 0,
            "stage": "Initializing",
            "grid_cells": [],
            "stats": {
                "discovered": 0,
                "researched": 0,
                "emails_found": 0,
                "phones_found": 0,
                "decision_makers_found": 0,
                "saved_new": 0,
                "duplicates": 0,
                "errors": 0
            },
            "recent_events": []
        }

        self.job_thread = threading.Thread(target=self._run_process, daemon=True)
        self.job_thread.start()
        return self.active_job

    def pause(self):
        self._pause_event.clear()
        if self.active_job:
            self.active_job["stage"] = "Paused"
            self._log_event("Job paused by user.")

    def resume(self):
        self._pause_event.set()
        if self.active_job:
            self.active_job["stage"] = "Running"
            self._log_event("Job resumed.")

    def cancel(self):
        self._cancel_flag = True
        self._pause_event.set()
        if self.active_job:
            self.active_job["stage"] = "Cancelled"
            self._log_event("Job cancellation requested.")

    def _log_event(self, message: str):
        if self.active_job:
            timestamp = datetime.now().strftime("%H:%M:%S")
            self.active_job["recent_events"].insert(0, f"[{timestamp}] {message}")
            if len(self.active_job["recent_events"]) > 50:
                self.active_job["recent_events"].pop()

    def _run_process(self):
        job = self.active_job
        job["stage"] = "Running"
        self._log_event(f"Started run: {len(job['professions'])} professions, {len(job['cities'])} cities.")

        try:
            for prof in job["professions"]:
                if self._cancel_flag:
                    break
                job["current_profession"] = prof
                prof_slug = slugify(prof)

                for city in job["cities"]:
                    if self._cancel_flag:
                        break
                    job["current_city"] = city
                    self._log_event(f"Resolving city viewport for: {city} ({prof})")

                    geo = self.places_service.geocode_city(city)
                    if not geo:
                        job["stats"]["errors"] += 1
                        self._log_event(f"Could not resolve {city}. Skipping.")
                        continue

                    grid = self.places_service.create_3x3_grid(geo["viewport"], job["expansion_factor"])
                    job["grid_cells"] = grid

                    city_leads = []

                    for cell in grid:
                        if self._cancel_flag:
                            break
                        self._pause_event.wait()

                        job["current_cell"] = cell["cell_id"]
                        cell["status"] = "Searching"
                        self._log_event(f"Searching Cell {cell['cell_id']}/9 in {city}")

                        places, next_token = self.places_service.search_cell_businesses(prof, cell)
                        cell["results_found"] = len(places)
                        cell["status"] = "Completed" if places else "No Results"
                        job["stats"]["discovered"] += len(places)

                        for p in places:
                            p["city"] = city
                            p["profession"] = prof
                            city_leads.append(p)

                        time.sleep(0.2)

                    self._log_event(f"Crawling {len(city_leads)} business websites in {city}...")
                    processed_records = []
                    for item in city_leads:
                        if self._cancel_flag:
                            break
                        self._pause_event.wait()

                        website = item.get("website")
                        res = {
                            "email": "",
                            "phone": item.get("phone", ""),
                            "decision_maker_name": "",
                            "decision_maker_title": "",
                            "confidence": "Found on Maps",
                            "status": "New",
                            "source_urls": []
                        }

                        if website:
                            crawl_data = self.researcher.research_business(website, job["decision_maker_titles"])
                            job["stats"]["researched"] += 1
                            if crawl_data.get("email"):
                                res["email"] = crawl_data["email"]
                                job["stats"]["emails_found"] += 1
                            if crawl_data.get("phone"):
                                res["phone"] = crawl_data["phone"]
                                job["stats"]["phones_found"] += 1
                            if crawl_data.get("decision_maker_name"):
                                res["decision_maker_name"] = crawl_data["decision_maker_name"]
                                res["decision_maker_title"] = crawl_data.get("decision_maker_title", "")
                                job["stats"]["decision_makers_found"] += 1
                            res["source_urls"] = crawl_data.get("source_urls", [])
                            res["confidence"] = crawl_data.get("confidence", "First-Party Website")
                            res["status"] = crawl_data.get("status", "Verified")

                        lead_record = {
                            "business_name": item["business_name"],
                            "profession": prof,
                            "city": city,
                            "region": "",
                            "country": "UK",
                            "address": item.get("address", ""),
                            "business_email": res["email"],
                            "business_phone": res["phone"],
                            "website": website or "",
                            "place_id": item.get("place_id", ""),
                            "decision_maker_name": res["decision_maker_name"],
                            "decision_maker_title": res["decision_maker_title"],
                            "decision_maker_email": "",
                            "decision_maker_phone": "",
                            "data_source_urls": "; ".join(res["source_urls"]),
                            "data_confidence": res["confidence"],
                            "verification_status": res["status"],
                            "pipeline_stage": "New",
                            "priority": "Medium",
                            "notes": f"Discovered via Lead Finder 3x3 Grid ({city})",
                            "tags": f"{city}, {prof}",
                            "suppressed": "No",
                            "suppression_reason": ""
                        }
                        processed_records.append(lead_record)

                    if processed_records:
                        added, updated = self.csv_manager.append_leads(prof_slug, processed_records)
                        job["stats"]["saved_new"] += added
                        job["stats"]["duplicates"] += updated
                        self._log_event(f"Appended to {prof_slug}.csv (+{added} new, {updated} updated)")

            job["stage"] = "Completed" if not self._cancel_flag else "Cancelled"
            self._log_event("Lead discovery run completed.")

        except Exception as e:
            job["stage"] = "Failed"
            job["stats"]["errors"] += 1
            self._log_event(f"Encountered error: {str(e)}")


# ==============================================================================
# 6. CRM SERVICE (CRUD, PIPELINES, NOTES, SUPPRESSION)
# ==============================================================================

class CRMService:
    def __init__(self, csv_mgr: CSVManager):
        self.csv_manager = csv_mgr

    def get_lead_by_id(self, lead_id: str) -> Optional[Tuple[str, Dict]]:
        for meta in self.csv_manager.list_all_lists():
            leads = self.csv_manager.read_list(meta["slug"])
            for lead in leads:
                if lead.get("id") == lead_id:
                    return meta["slug"], lead
        return None

    def update_lead(self, lead_id: str, updates: Dict) -> Optional[Dict]:
        found = self.get_lead_by_id(lead_id)
        if not found:
            return None
        slug, lead = found
        leads = self.csv_manager.read_list(slug)
        for i, item in enumerate(leads):
            if item.get("id") == lead_id:
                for k, v in updates.items():
                    if k in item and k != "id":
                        item[k] = v
                item["lead_score"] = calculate_lead_score(item)
                leads[i] = item
                self.csv_manager.write_list(slug, leads)
                return item
        return None

    def log_activity(self, lead_id: str, action: str, note_text: str) -> Optional[Dict]:
        found = self.get_lead_by_id(lead_id)
        if not found:
            return None
        slug, lead = found
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        new_entry = f"[{timestamp}] {action}: {note_text}"
        current_notes = lead.get("notes", "").strip()
        updated_notes = f"{new_entry}\n{current_notes}" if current_notes else new_entry
        return self.update_lead(lead_id, {"notes": updated_notes})

    def find_potential_duplicates(self) -> List[Dict]:
        all_leads = self.csv_manager.read_all_leads()
        dupes = []
        seen = {}
        for lead in all_leads:
            web = lead.get("website", "").lower().strip()
            pid = lead.get("place_id", "").strip()
            key = pid if pid else (web if len(web) > 5 else None)
            if key:
                if key in seen:
                    dupes.append({
                        "original": seen[key],
                        "duplicate": lead,
                        "matched_on": "place_id" if pid else "website"
                    })
                else:
                    seen[key] = lead
        return dupes

    def merge_leads(self, primary_id: str, secondary_id: str, merged_fields: Dict) -> bool:
        primary_info = self.get_lead_by_id(primary_id)
        secondary_info = self.get_lead_by_id(secondary_id)
        if not primary_info or not secondary_info:
            return False

        p_slug, p_lead = primary_info
        s_slug, s_lead = secondary_info

        p_lead.update(merged_fields)
        p_lead["lead_score"] = calculate_lead_score(p_lead)
        
        s_leads = self.csv_manager.read_list(s_slug)
        s_leads = [l for l in s_leads if l.get("id") != secondary_id]
        self.csv_manager.write_list(s_slug, s_leads)

        p_leads = self.csv_manager.read_list(p_slug)
        for idx, item in enumerate(p_leads):
            if item.get("id") == primary_id:
                p_leads[idx] = p_lead
                break
        self.csv_manager.write_list(p_slug, p_leads)
        return True

    def toggle_suppression(self, lead_id: str, suppress: bool, reason: str = "") -> Optional[Dict]:
        updates = {
            "suppressed": "Yes" if suppress else "No",
            "suppression_reason": reason if suppress else "",
            "pipeline_stage": "Do Not Contact" if suppress else "New"
        }
        return self.update_lead(lead_id, updates)


# ==============================================================================
# 7. FLASK APP & API ROUTE CONTROLLER
# ==============================================================================

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app, resources={r"/api/*": {"origins": "*"}})

csv_manager = CSVManager(DATA_DIR)
places_service = GooglePlacesService()
researcher = WebsiteResearcher()
job_runner = LeadFinderJobRunner(csv_manager, places_service, researcher)
crm_service = CRMService(csv_manager)

# --- Static Frontend Serving ---

@app.route("/")
def serve_index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def serve_static(path):
    if os.path.exists(path):
        return send_from_directory(".", path)
    return send_from_directory(".", "index.html")

# --- API Endpoints ---

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "Aurelius CRM & Lead Finder API",
        "google_places_configured": places_service.is_configured()
    })

@app.route("/api/stats/overview", methods=["GET"])
def get_overview_stats():
    all_leads = csv_manager.read_all_leads()
    total_leads = len(all_leads)
    verified_emails = sum(1 for l in all_leads if l.get("business_email"))
    verified_phones = sum(1 for l in all_leads if l.get("business_phone"))
    decision_makers = sum(1 for l in all_leads if l.get("decision_maker_name"))
    ready_to_contact = sum(1 for l in all_leads if l.get("pipeline_stage") in ("Qualified", "Ready to Contact"))
    
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    followups_due = sum(1 for l in all_leads if l.get("next_followup") and l.get("next_followup") <= today_str)

    pipeline = {}
    for l in all_leads:
        stg = l.get("pipeline_stage", "New")
        pipeline[stg] = pipeline.get(stg, 0) + 1

    return jsonify({
        "total_prospects": total_leads,
        "total_lists": len(csv_manager.list_all_lists()),
        "verified_emails": verified_emails,
        "verified_phones": verified_phones,
        "decision_makers_found": decision_makers,
        "ready_to_contact": ready_to_contact,
        "followups_due": followups_due,
        "pipeline_stages": pipeline
    })

@app.route("/api/lists", methods=["GET"])
def get_lists():
    return jsonify(csv_manager.list_all_lists())

@app.route("/api/leads", methods=["GET"])
def get_leads():
    list_slug = request.args.get("list", "").strip()
    query = request.args.get("q", "").strip().lower()
    stage = request.args.get("stage", "").strip()
    priority = request.args.get("priority", "").strip()
    filter_type = request.args.get("filter", "").strip()

    if list_slug:
        leads = csv_manager.read_list(list_slug)
    else:
        leads = csv_manager.read_all_leads()

    if query:
        leads = [
            l for l in leads
            if query in l.get("business_name", "").lower()
            or query in l.get("city", "").lower()
            or query in l.get("business_email", "").lower()
            or query in l.get("decision_maker_name", "").lower()
            or query in l.get("business_phone", "").lower()
        ]

    if stage:
        leads = [l for l in leads if l.get("pipeline_stage") == stage]

    if priority:
        leads = [l for l in leads if l.get("priority") == priority]

    if filter_type == "missing_email":
        leads = [l for l in leads if not l.get("business_email")]
    elif filter_type == "missing_phone":
        leads = [l for l in leads if not l.get("business_phone")]
    elif filter_type == "missing_decision_maker":
        leads = [l for l in leads if not l.get("decision_maker_name")]
    elif filter_type == "verified":
        leads = [l for l in leads if l.get("business_email") and l.get("verification_status") in ("Verified", "High Confidence")]
    elif filter_type == "needs_followup":
        leads = [l for l in leads if l.get("next_followup")]

    return jsonify({"count": len(leads), "leads": leads})

@app.route("/api/leads/<lead_id>", methods=["GET", "PUT", "DELETE"])
def handle_lead(lead_id):
    if request.method == "GET":
        found = crm_service.get_lead_by_id(lead_id)
        if not found:
            return jsonify({"error": "Lead not found"}), 404
        return jsonify({"list": found[0], "lead": found[1]})

    elif request.method == "PUT":
        data = request.json or {}
        updated = crm_service.update_lead(lead_id, data)
        if not updated:
            return jsonify({"error": "Lead not found"}), 404
        return jsonify({"success": True, "lead": updated})

    elif request.method == "DELETE":
        found = crm_service.get_lead_by_id(lead_id)
        if not found:
            return jsonify({"error": "Lead not found"}), 404
        slug, _ = found
        all_l = csv_manager.read_list(slug)
        all_l = [l for l in all_l if l.get("id") != lead_id]
        csv_manager.write_list(slug, all_l)
        return jsonify({"success": True, "message": "Lead deleted from list"})

@app.route("/api/leads/<lead_id>/activity", methods=["POST"])
def post_activity(lead_id):
    data = request.json or {}
    action = data.get("action", "Note Added")
    note = data.get("note", "").strip()
    if not note:
        return jsonify({"error": "Note text is required"}), 400
    updated = crm_service.log_activity(lead_id, action, note)
    return jsonify({"success": True, "lead": updated})

@app.route("/api/leads/<lead_id>/research", methods=["POST"])
def retry_research(lead_id):
    found = crm_service.get_lead_by_id(lead_id)
    if not found:
        return jsonify({"error": "Lead not found"}), 404
    slug, lead = found
    website = lead.get("website")
    if not website:
        return jsonify({"error": "No website URL provided"}), 400

    data = researcher.research_business(website)
    updates = {
        "last_verified": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "data_confidence": data.get("confidence", "First-Party Website"),
        "verification_status": data.get("status", "Verified")
    }
    if data.get("email"):
        updates["business_email"] = data["email"]
    if data.get("phone"):
        updates["business_phone"] = data["phone"]
    if data.get("decision_maker_name"):
        updates["decision_maker_name"] = data["decision_maker_name"]
        updates["decision_maker_title"] = data.get("decision_maker_title", "")
    
    crm_service.log_activity(lead_id, "Website Re-researched", f"Crawled {len(data.get('source_urls', []))} pages.")
    updated = crm_service.update_lead(lead_id, updates)
    return jsonify({"success": True, "lead": updated})

@app.route("/api/leads/manual", methods=["POST"])
def create_manual_lead():
    data = request.json or {}
    profession = data.get("profession", "General").strip() or "General"
    slug = slugify(profession)

    added, _ = csv_manager.append_leads(slug, [data])
    return jsonify({"success": True, "added": added})

@app.route("/api/leads/duplicates", methods=["GET"])
def get_duplicates():
    dupes = crm_service.find_potential_duplicates()
    return jsonify({"count": len(dupes), "duplicates": dupes})

@app.route("/api/leads/merge", methods=["POST"])
def merge_leads():
    data = request.json or {}
    p_id = data.get("primary_id")
    s_id = data.get("secondary_id")
    fields = data.get("fields", {})
    success = crm_service.merge_leads(p_id, s_id, fields)
    return jsonify({"success": success})

@app.route("/api/leads/suppression", methods=["POST"])
def toggle_suppression():
    data = request.json or {}
    lead_id = data.get("lead_id")
    suppress = data.get("suppress", True)
    reason = data.get("reason", "Suppressed by operator")
    updated = crm_service.toggle_suppression(lead_id, suppress, reason)
    return jsonify({"success": True, "lead": updated})

# --- Lead Finder API Controls ---

@app.route("/api/jobs/start", methods=["POST"])
def start_lead_search():
    data = request.json or {}
    professions = data.get("professions", [])
    cities = data.get("cities", [])
    titles = data.get("decision_maker_titles", [])
    expansion = float(data.get("expansion_factor", 1.20))

    if not professions or not cities:
        return jsonify({"error": "At least one profession and one city required."}), 400

    try:
        job = job_runner.start_job(professions, cities, titles, expansion)
        return jsonify({"success": True, "job": job})
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 409

@app.route("/api/jobs/status", methods=["GET"])
def get_job_status():
    return jsonify(job_runner.get_status())

@app.route("/api/jobs/pause", methods=["POST"])
def pause_job():
    job_runner.pause()
    return jsonify({"success": True})

@app.route("/api/jobs/resume", methods=["POST"])
def resume_job():
    job_runner.resume()
    return jsonify({"success": True})

@app.route("/api/jobs/cancel", methods=["POST"])
def cancel_job():
    job_runner.cancel()
    return jsonify({"success": True})

# --- Export & Import ---

@app.route("/api/export/<list_slug>", methods=["GET"])
def export_list(list_slug):
    filepath = csv_manager._get_filepath(list_slug)
    if not os.path.exists(filepath):
        return jsonify({"error": "List file not found"}), 404
    return send_file(filepath, as_attachment=True, download_name=f"{list_slug}_export.csv", mimetype="text/csv")

@app.route("/api/export/backup/all", methods=["GET"])
def backup_all_csvs():
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, _, files in os.walk(csv_manager.data_dir):
            for file in files:
                if file.endswith(".csv"):
                    full_p = os.path.join(root, file)
                    zip_file.write(full_p, arcname=file)
    memory_file.seek(0)
    return send_file(memory_file, download_name="crm_data_backup.zip", as_attachment=True, mimetype="application/zip")

@app.route("/api/import", methods=["POST"])
def import_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    f = request.files["file"]
    target_list = request.form.get("target_list", "imported").strip() or "imported"
    slug = slugify(target_list)

    stream = io.StringIO(f.stream.read().decode("utf-8-sig", errors="ignore"))
    reader = csv.DictReader(stream)

    imported_leads = []
    for row in reader:
        lead = {
            "business_name": row.get("business_name") or row.get("Company") or row.get("Name") or "",
            "profession": target_list.title(),
            "city": row.get("city") or row.get("City") or "",
            "business_email": row.get("business_email") or row.get("Email") or "",
            "business_phone": row.get("business_phone") or row.get("Phone") or "",
            "website": row.get("website") or row.get("Website") or "",
            "decision_maker_name": row.get("decision_maker_name") or row.get("Contact") or "",
            "decision_maker_title": row.get("decision_maker_title") or row.get("Title") or "",
            "pipeline_stage": row.get("pipeline_stage") or "New",
            "priority": row.get("priority") or "Medium",
            "notes": "Imported from external CSV"
        }
        if lead["business_name"]:
            imported_leads.append(lead)

    added, updated = csv_manager.append_leads(slug, imported_leads)
    return jsonify({"success": True, "added": added, "updated": updated, "list": slug})

@app.route("/api/settings", methods=["GET", "POST"])
def handle_settings():
    if request.method == "GET":
        return jsonify({
            "google_places_configured": places_service.is_configured(),
            "max_crawl_pages": researcher.max_pages_per_site
        })
    elif request.method == "POST":
        data = request.json or {}
        api_key = data.get("google_places_api_key")
        if api_key is not None:
            places_service.api_key = api_key.strip()
        if data.get("max_crawl_pages"):
            researcher.max_pages_per_site = int(data["max_crawl_pages"])
        return jsonify({"success": True, "message": "Settings updated"})


# ==============================================================================
# 8. APPLICATION ENTRYPOINT
# ==============================================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("\n" + "=" * 68)
    print("  ✦ AURELIUS CRM & LEAD FINDER PLATFORM")
    print(f"  Server Active: http://127.0.0.1:{port}")
    print(f"  Data Storage Directory: {DATA_DIR}")
    print("=" * 68 + "\n")
    app.run(host="0.0.0.0", port=port, debug=False)