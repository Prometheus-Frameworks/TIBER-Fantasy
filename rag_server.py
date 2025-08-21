#!/usr/bin/env python3
"""
RAG Starter — Fantasy Football Takes (ESPN + NFL.com)  |  v0.2
Single-file Flask server with:
- Ingestion from ESPN NFL RSS + NFL.com News (RSS or HTML fallback)
- Sleeper dictionary mapping (player name -> player_id/team/pos)
- Lightweight hybrid retrieval (TF-IDF vector + recency boost)
- Simple, deterministic "Strong Take" generator (no LLM required)
- /api/rag/take endpoint (player_id + optional topic)

Swap the generator with your model to go brrrr.
"""

import os
import re
import time
import math
import json
import hashlib
import sqlite3
import logging
import datetime as dt
from typing import List, Dict, Any, Optional

import requests
from bs4 import BeautifulSoup

from flask import Flask, request, jsonify
import feedparser

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ---------------------------
# Config
# ---------------------------

ESPN_RSS = os.getenv("ESPN_RSS", "https://www.espn.com/espn/rss/nfl/news")
NFL_RSS  = os.getenv("NFL_RSS",  "https://www.nfl.com/rss/rsslanding?searchString=news")
NFL_NEWS_FALLBACK = os.getenv("NFL_NEWS_FALLBACK", "https://www.nfl.com/news/")
SLEEPER_PLAYERS_URL = os.getenv("SLEEPER_PLAYERS_URL", "https://api.sleeper.app/v1/players/nfl")

DB_PATH = os.getenv("RAG_DB", "rag_news.db")

NEWS_MAX_AGE_DAYS = int(os.getenv("NEWS_MAX_AGE_DAYS", "21"))
RAG_TOPK = int(os.getenv("RAG_TOPK", "5"))
RAG_MIN_SOURCES = int(os.getenv("RAG_MIN_SOURCES", "2"))

# ---------------------------
# App / Logging
# ---------------------------

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("rag")

# ---------------------------
# DB Setup
# ---------------------------

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            source TEXT,
            title TEXT,
            url TEXT,
            published_at TEXT,
            text TEXT,
            team_tags TEXT,
            player_ids TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS players (
            player_id TEXT PRIMARY KEY,
            name TEXT,
            team TEXT,
            position TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

# ---------------------------
# Sleeper Dictionary
# ---------------------------

_sleeper_cache = {
    "players_by_id": {},
    "name_to_id": {}
}

def normalize_name(n: str) -> str:
    return re.sub(r"[^a-z]", "", (n or "").lower())

def load_sleeper_dictionary():
    """Loads name -> player_id map from Sleeper."""
    global _sleeper_cache
    log.info("Fetching Sleeper players…")
    r = requests.get(SLEEPER_PLAYERS_URL, timeout=60)
    r.raise_for_status()
    data = r.json()
    players_by_id = {}
    name_to_id = {}
    conn = db()
    cur = conn.cursor()
    inserted = 0
    for pid, p in data.items():
        if not isinstance(p, dict): 
            continue
        name = p.get("full_name") or p.get("first_name","") + " " + p.get("last_name","")
        team = p.get("team")
        pos = p.get("position")
        if not name or not pos:
            continue
        players_by_id[pid] = {"player_id": pid, "name": name, "team": team, "position": pos}
        name_to_id[normalize_name(name)] = pid

        # upsert into DB
        cur.execute("""
            INSERT INTO players (player_id, name, team, position)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(player_id) DO UPDATE SET name=excluded.name, team=excluded.team, position=excluded.position
        """, (pid, name, team, pos))
        inserted += 1

    conn.commit()
    conn.close()
    _sleeper_cache["players_by_id"] = players_by_id
    _sleeper_cache["name_to_id"] = name_to_id
    log.info(f"Sleeper: mapped {inserted} players.")

def name_to_player_id(name: str) -> Optional[str]:
    return _sleeper_cache["name_to_id"].get(normalize_name(name))

def find_player_mentions(text: str) -> List[str]:
    """naive name matching using known player last names + full names"""
    found = set()
    # Exact full-name scan (fast enough for our volumes)
    for nm, pid in _sleeper_cache["name_to_id"].items():
        if nm and nm in normalize_name(text):
            found.add(pid)
    return list(found)

# ---------------------------
# Ingest News
# ---------------------------

def article_id(source: str, title: str, url: str, published_at: str) -> str:
    h = hashlib.sha256(f"{source}|{title}|{url}|{published_at}".encode()).hexdigest()
    return h[:32]

def parse_date(s: str) -> Optional[dt.datetime]:
    try:
        # Parse RSS date strings using feedparser's time module
        parsed_time = feedparser._parse_date(s) if hasattr(feedparser, '_parse_date') else time.strptime(s, "%a, %d %b %Y %H:%M:%S %Z")
        return dt.datetime(*parsed_time[:6], tzinfo=dt.timezone.utc)
    except Exception:
        try:
            return dt.datetime.fromisoformat(s.replace("Z","+00:00"))
        except Exception:
            return None

def within_age(published_at: str, max_days=NEWS_MAX_AGE_DAYS) -> bool:
    d = parse_date(published_at)
    if not d:
        return True  # keep if unknown
    return (dt.datetime.now(dt.timezone.utc) - d).days <= max_days

def fetch_espn():
    d = feedparser.parse(ESPN_RSS)
    items = []
    for e in d.entries:
        title = e.get("title", "").strip()
        url = e.get("link", "").strip()
        published = e.get("published", "") or e.get("updated", "") or dt.datetime.now(dt.timezone.utc).isoformat()
        summary = BeautifulSoup(e.get("summary", ""), "html.parser").get_text(" ", strip=True)
        if not title or not url: 
            continue
        items.append({
            "source": "ESPN",
            "title": title, "url": url,
            "published_at": published,
            "text": summary
        })
    return items

def fetch_nfl_rss():
    d = feedparser.parse(NFL_RSS)
    items = []
    for e in d.entries:
        title = e.get("title", "").strip()
        url = e.get("link", "").strip()
        published = e.get("published", "") or e.get("updated", "") or dt.datetime.now(dt.timezone.utc).isoformat()
        summary = BeautifulSoup(e.get("summary", ""), "html.parser").get_text(" ", strip=True)
        if not title or not url:
            continue
        items.append({
            "source": "NFL",
            "title": title, "url": url,
            "published_at": published,
            "text": summary
        })
    return items

def fetch_nfl_fallback():
    # Very light HTML scrape of nfl.com/news landing; structure can change.
    items = []
    try:
        r = requests.get(NFL_NEWS_FALLBACK, timeout=30)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.select("a[href*='/news/']"):
            title = (a.get_text() or "").strip()
            url = a.get("href", "")
            if not title or not url:
                continue
            if not str(url).startswith("http"):
                url = "https://www.nfl.com" + str(url)
            items.append({
                "source": "NFL",
                "title": title,
                "url": url,
                "published_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "text": title
            })
    except Exception as e:
        log.warning(f"NFL fallback scrape failed: {e}")
    return items

def upsert_articles(items: List[Dict[str, Any]]):
    conn = db()
    cur = conn.cursor()
    inserted = 0
    for it in items:
        if not within_age(it["published_at"]):
            continue
        # Fetch article body if the feed only gives summary (best-effort)
        body = it.get("text", "")
        if body and len(body) < 280:
            try:
                rr = requests.get(it["url"], timeout=20)
                soup = BeautifulSoup(rr.text, "html.parser")
                # generic paragraph collection
                paras = [p.get_text(" ", strip=True) for p in soup.select("p")]
                if paras:
                    body = " ".join(paras[:12])  # cap to keep DB small
            except Exception:
                pass

        pids = find_player_mentions(body)
        team_tags = []  # optional: quick team code regex like r"\b([A-Z]{2,3})\b"

        aid = article_id(it["source"], it["title"], it["url"], it["published_at"])
        cur.execute("""
            INSERT INTO articles (id, source, title, url, published_at, text, team_tags, player_ids)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              text=excluded.text, team_tags=excluded.team_tags, player_ids=excluded.player_ids
        """, (aid, it["source"], it["title"], it["url"], it["published_at"], body, json.dumps(team_tags), json.dumps(pids)))
        inserted += 1
    conn.commit()
    conn.close()
    log.info(f"Ingested/updated {inserted} articles.")

def ingest_all():
    log.info("Ingestion start…")
    try:
        load_sleeper_dictionary()
    except Exception as e:
        log.warning(f"Sleeper load failed (continuing): {e}")
    items = []
    try:
        items += fetch_espn()
    except Exception as e:
        log.warning(f"ESPN fetch failed: {e}")
    try:
        nfl_items = fetch_nfl_rss()
        if not nfl_items:
            nfl_items = fetch_nfl_fallback()
        items += nfl_items
    except Exception as e:
        log.warning(f"NFL fetch failed: {e}")
    upsert_articles(items)
    log.info("Ingestion done.")

# ---------------------------
# Retrieval (TF-IDF + Recency)
# ---------------------------

_vectorizer = None
_matrix = None
_corpus_ids: List[str] = []

def recency_boost(pub_iso: str) -> float:
    try:
        d = parse_date(pub_iso) or dt.datetime.now(dt.timezone.utc)
        days = max(0.0, (dt.datetime.now(dt.timezone.utc) - d).days)
        # 1.0 when fresh; decays to ~0.5 by 7d; ~0.3 by 21d
        return 1.0 / (1.0 + (days/7.0))
    except Exception:
        return 0.8

def build_index():
    global _vectorizer, _matrix, _corpus_ids
    conn = db()
    rows = conn.execute("SELECT id, title, text, published_at FROM articles ORDER BY published_at DESC").fetchall()
    conn.close()
    docs = []
    ids = []
    for r in rows:
        text = (r["title"] or "") + " " + (r["text"] or "")
        docs.append(text)
        ids.append(r["id"])
    if not docs:
        _vectorizer = None
        _matrix = None
        _corpus_ids = []
        return
    _vectorizer = TfidfVectorizer(stop_words="english", max_features=25000)
    _matrix = _vectorizer.fit_transform(docs)
    _corpus_ids = ids
    log.info(f"Index built with {len(ids)} docs.")

def retrieve(player_id: str, topic: Optional[str]) -> List[Dict[str, Any]]:
    """Return top K articles about player, biased to recency."""
    conn = db()
    # prioritize rows that mention the player_id; fallback to topic search
    rows = conn.execute("SELECT * FROM articles").fetchall()
    conn.close()
    by_player = [r for r in rows if r["player_ids"] and player_id in json.loads(r["player_ids"])]
    candidate_ids = set([r["id"] for r in by_player])

    if _vectorizer is not None and topic:
        q = topic
        q_vec = _vectorizer.transform([q])
        sims = cosine_similarity(q_vec, _matrix).ravel()
        scored = sorted([(i, sims[i]) for i in range(len(sims))], key=lambda x: x[1], reverse=True)[:50]
        for i, s in scored:
            candidate_ids.add(_corpus_ids[i])

    # Pull candidates
    conn = db()
    cands = []
    for cid in candidate_ids:
        r = conn.execute("SELECT * FROM articles WHERE id = ?", (cid,)).fetchone()
        if not r:
            continue
        cands.append(dict(r))
    conn.close()

    # Score = tfidf topic similarity (if available) * 0.6 + recency 0.4
    scored_out = []
    for r in cands:
        base = 0.0
        if _vectorizer is not None and topic:
            q_vec = _vectorizer.transform([topic])
            doc = _vectorizer.transform([" ".join([(r["title"] or ""), (r["text"] or "")])])
            base = float(cosine_similarity(q_vec, doc).ravel()[0])
        fresh = recency_boost(r["published_at"] or "")
        score = 0.6*base + 0.4*fresh
        scored_out.append((score, r))

    scored_out.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored_out[:RAG_TOPK]]

# ---------------------------
# Generator (Deterministic / Replaceable)
# ---------------------------

def format_citations(rows: List[Dict[str, Any]]):
    out = []
    for r in rows:
        out.append({
            "title": r.get("title"),
            "url": r.get("url"),
            "published_at": r.get("published_at"),
            "source": r.get("source")
        })
    return out

def generate_take(player_id: str, topic: Optional[str], articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Deterministic take generator (no LLM). Replace this with your model."""
    if not articles:
        return {
            "headline": "No Recent News",
            "take": "No recent news or analysis available for this player.",
            "verdict": "HOLD",
            "confidence": 0.1
        }

    # Get player info
    player = _sleeper_cache["players_by_id"].get(player_id, {})
    name = player.get("name", "Player")
    pos = player.get("position", "").upper()
    team = player.get("team", "").upper()

    # Simple keyword analysis for sentiment
    all_text = " ".join([a.get("text", "") + " " + a.get("title", "") for a in articles])
    all_text_lower = all_text.lower()

    # Positive signals
    pos_signals = ["breakout", "increased role", "healthy", "starting", "opportunity", "targets", "touches", "upside", "prime", "improvement"]
    neg_signals = ["injury", "limited", "questionable", "doubt", "concern", "competition", "struggle", "decline", "benched", "suspension"]

    pos_score = sum(1 for s in pos_signals if s in all_text_lower)
    neg_score = sum(1 for s in neg_signals if s in all_text_lower)

    # Position-specific logic
    verdict = "HOLD"
    confidence = 0.5
    take_parts = []

    if pos_score > neg_score + 1:
        verdict = "BUY"
        confidence = min(0.9, 0.6 + (pos_score - neg_score) * 0.1)
        take_parts.append(f"Recent news suggests positive momentum for {name}.")
        
        if pos == "QB":
            take_parts.append("Quarterback improvements can create league-winning upside.")
        elif pos in ["RB", "WR", "TE"]:
            take_parts.append(f"Opportunity increases at {pos} often translate to fantasy value.")
            
    elif neg_score > pos_score + 1:
        verdict = "SELL"
        confidence = min(0.9, 0.6 + (neg_score - pos_score) * 0.1)
        take_parts.append(f"Recent reports raise concerns about {name}'s outlook.")
        
        if "injury" in all_text_lower:
            take_parts.append("Injury concerns create significant risk.")
        if "competition" in all_text_lower:
            take_parts.append("Increased competition could limit opportunities.")
    else:
        take_parts.append(f"Mixed signals in recent news for {name}.")
        take_parts.append("Monitor situation closely for clearer direction.")

    # Add topic-specific analysis
    if topic:
        topic_lower = topic.lower()
        if "trade" in topic_lower or "quarterback change" in topic_lower:
            take_parts.append("Team changes can create volatility in player value.")
            confidence *= 0.8  # Reduce confidence for uncertain situations

    take = " ".join(take_parts)
    
    # Generate headline
    headlines = {
        "BUY": f"{name} Showing Positive Signs",
        "SELL": f"Concerns Mount for {name}",
        "HOLD": f"{name} Status Remains Unclear"
    }
    headline = headlines.get(verdict, f"{name} Fantasy Outlook")

    return {
        "headline": headline,
        "take": take,
        "verdict": verdict,
        "confidence": confidence
    }

# ---------------------------
# API Endpoints
# ---------------------------

@app.route("/health")
def health():
    return {"status": "healthy", "timestamp": dt.datetime.now(dt.timezone.utc).isoformat()}

@app.route("/admin/ingest", methods=["POST"])
def admin_ingest():
    try:
        ingest_all()
        build_index()
        return {"status": "success", "message": "Ingestion and indexing complete"}
    except Exception as e:
        log.error(f"Ingest failed: {e}")
        return {"status": "error", "message": str(e)}, 500

@app.route("/api/players/search")
def search_players():
    name = request.args.get("name", "").strip()
    if not name:
        return {"error": "name parameter required"}, 400
    
    pid = name_to_player_id(name)
    if not pid:
        return {"error": "player not found"}, 404
    
    player = _sleeper_cache["players_by_id"].get(pid)
    return {"player_id": pid, "player": player}

@app.route("/api/rag/take")
def rag_take():
    player_id = request.args.get("player_id", "").strip()
    topic = request.args.get("topic", "").strip() or None
    
    if not player_id:
        return {"error": "player_id parameter required"}, 400
    
    if player_id not in _sleeper_cache["players_by_id"]:
        return {"error": "invalid player_id"}, 404
    
    # Retrieve relevant articles
    articles = retrieve(player_id, topic)
    
    if len(articles) < RAG_MIN_SOURCES:
        return {
            "headline": "Limited Information Available",
            "take": f"Insufficient recent news to generate analysis (found {len(articles)} sources, need {RAG_MIN_SOURCES}).",
            "verdict": "HOLD",
            "confidence": 0.2,
            "citations": format_citations(articles)
        }
    
    # Generate take
    result = generate_take(player_id, topic, articles)
    result["citations"] = format_citations(articles)
    
    return result

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8001, debug=False)