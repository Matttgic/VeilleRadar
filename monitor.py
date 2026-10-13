#!/usr/bin/env python3
"""VeilleRadar MVP: monitor public pages, store snapshots, and queue Telegram alerts.

This is an owner-operated prototype, not a multi-tenant SaaS.
"""
from __future__ import annotations

import hashlib
import ipaddress
import json
import os
import re
import socket
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "config" / "monitors.json"
STATE = ROOT / "state.json"
PUBLIC = ROOT / "docs" / "data.json"
ALERTS = ROOT / "pending_alerts.json"
UA = "VeilleRadar/0.1 (+owner-operated change monitor; public pages only)"
MAX_BYTES = 1_000_000
MAX_SITES = 20
TIMEOUT = 15


def safe_url(value: str, *, resolver=socket.getaddrinfo) -> str:
    """Reject obvious SSRF addresses before fetch and on each redirect."""
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError("Adresse URL invalide")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Seules les pages publiques HTTP(S) sont acceptées")
    if parsed.hostname.lower() in {"localhost", "localhost.localdomain"} or parsed.hostname.endswith(".local"):
        raise ValueError("Adresse privée refusée")
    port = parsed.port
    if port is not None and port not in {80, 443}:
        raise ValueError("Port non standard refusé")
    try:
        infos = resolver(parsed.hostname, port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except (socket.gaierror, OSError) as exc:
        raise ValueError("Domaine impossible à résoudre") from exc
    if not infos:
        raise ValueError("Domaine impossible à résoudre")
    for info in infos:
        addr = ipaddress.ip_address(info[4][0])
        if not addr.is_global:
            raise ValueError("Adresse réseau privée ou réservée refusée")
    return value


def fetch_page(url: str, *, session=None, validator=safe_url) -> str:
    client = session or requests.Session()
    current = url
    for _ in range(4):
        validator(current)
        with client.get(current, headers={"User-Agent": UA, "Accept": "text/html, text/plain"},
                        timeout=TIMEOUT, stream=True, allow_redirects=False) as response:
            if response.status_code in {301, 302, 303, 307, 308}:
                next_url = response.headers.get("Location")
                if not next_url:
                    raise ValueError("Redirection sans destination")
                current = urljoin(current, next_url)
                continue
            response.raise_for_status()
            media_type = response.headers.get("Content-Type", "text/html").split(";", 1)[0].lower()
            if media_type not in {"text/html", "text/plain", "application/xhtml+xml"}:
                raise ValueError("Type de contenu non pris en charge")
            raw = bytearray()
            for chunk in response.iter_content(16_384):
                raw.extend(chunk)
                if len(raw) > MAX_BYTES:
                    raise ValueError("Page trop volumineuse")
            response.encoding = response.encoding or "utf-8"
            return bytes(raw).decode(response.encoding, errors="replace")
    raise ValueError("Trop de redirections")


def extract_text(html: str, selector: str = "") -> str:
    soup = BeautifulSoup(html, "html.parser")
    if selector:
        matches = soup.select(selector)
        if not matches:
            raise ValueError("Sélecteur CSS absent de la page")
        value = "\n".join(e.get_text(" ", strip=True) for e in matches)
    else:
        for e in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
            e.decompose()
        value = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", value).strip()[:100_000]


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def monitor_once(monitors: list, previous: dict, *, fetch=fetch_page, now=None):
    now = now or datetime.now(timezone.utc).isoformat(timespec="seconds")
    old = previous.get("watches", {}) if isinstance(previous, dict) else {}
    watches, alerts = {}, []
    old_history = previous.get("history", []) if isinstance(previous, dict) else []
    history = list(old_history) if isinstance(old_history, list) else []
    for item in monitors:
        key = item["id"]
        row = {"id": key, "name": item["name"], "url": item["url"],
               "selector": item.get("selector", ""), "last_checked": now}
        prior = old.get(key, {}) if isinstance(old, dict) else {}
        prior_hash = prior.get("hash") if prior.get("url") == item["url"] and prior.get("selector", "") == item.get("selector", "") else None
        try:
            value = extract_text(fetch(item["url"]), item.get("selector", ""))
            if not value:
                raise ValueError("Aucun texte exploitable")
            checksum = hashlib.sha256(value.encode("utf-8")).hexdigest()
            row.update(hash=checksum, excerpt=value[:240], last_change=prior.get("last_change"),
                       changes=prior.get("changes", 0), status="ok", error=None)
            if prior_hash and prior_hash != checksum:
                row["changes"] += 1
                row["last_change"] = now
                row["status"] = "changed"
                event = {"id": key, "name": item["name"], "url": item["url"],
                         "at": now, "before": prior.get("excerpt", "")[:160], "after": value[:160]}
                history.insert(0, event)
                alerts.append(event)
            elif prior_hash is None:
                row["status"] = "baseline"  # First observation: never trigger alert.
        except (ValueError, requests.RequestException, UnicodeError) as exc:
            # Errors never erase a valid snapshot or trigger false alerts.
            row.update(hash=prior.get("hash"), excerpt=prior.get("excerpt", ""),
                       last_change=prior.get("last_change"), changes=prior.get("changes", 0),
                       status="error", error=str(exc)[:120])
        watches[key] = row
    state = {"schema_version": 1, "updated_at": now, "watches": watches, "history": history[:50]}
    return state, alerts


def validate_config(raw):
    items = raw.get("monitors") if isinstance(raw, dict) else None
    if not isinstance(items, list) or len(items) > MAX_SITES:
        raise ValueError("La configuration doit contenir au maximum 20 surveillances")
    ids = set()
    for item in items:
        if not isinstance(item, dict) or not re.fullmatch(r"[a-z0-9_-]{2,40}", str(item.get("id", ""))):
            raise ValueError("Identifiant de surveillance invalide")
        if item["id"] in ids:
            raise ValueError("Identifiant en double")
        ids.add(item["id"])
        if not isinstance(item.get("name"), str) or not 1 <= len(item["name"]) <= 80:
            raise ValueError("Nom de surveillance invalide")
        if not isinstance(item.get("url"), str):
            raise ValueError("URL manquante")
        selector = item.get("selector", "")
        if not isinstance(selector, str) or len(selector) > 150:
            raise ValueError("Sélecteur CSS invalide")
    return items


def main():
    monitors = validate_config(load_json(CONFIG, {"monitors": []}))
    previous = load_json(STATE, {"watches": {}, "history": []})
    result, alerts = monitor_once(monitors, previous)
    for file, value in [(STATE, result), (PUBLIC, result), (ALERTS, {"alerts": alerts})]:
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"VeilleRadar: {len(monitors)} surveillances ; {len(alerts)} changements ; "
          f"{sum(w['status']=='error' for w in result['watches'].values())} erreurs")


if __name__ == "__main__":
    main()
