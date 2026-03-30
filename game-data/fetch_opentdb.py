#!/usr/bin/env python3
"""
Fetch all verified trivia questions from Open Trivia Database (OpenTDB).

Strategy: Fetch per category (no difficulty filter) to maximize yield per token.
Session tokens track which questions have been returned — once a category is
exhausted (response_code=4), we move to the next. After all categories are done,
reset token and do a second pass to catch any stragglers.

API docs: https://opentdb.com/api_config.php
Rate limit: 1 request per 5 seconds per IP
License: CC BY-SA 4.0

Usage:
    python3 fetch_opentdb.py
"""

import json
import time
import sys
import os
import html
from urllib.parse import unquote
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# ============================================================
# OpenTDB API Configuration
# ============================================================

API_BASE = "https://opentdb.com/api.php"
TOKEN_URL = "https://opentdb.com/api_token.php?command=request"
RESET_TOKEN_URL = "https://opentdb.com/api_token.php?command=reset&token={}"

# All 24 OpenTDB category IDs
CATEGORIES = {
    9: "General Knowledge",
    10: "Entertainment: Books",
    11: "Entertainment: Film",
    12: "Entertainment: Music",
    13: "Entertainment: Musicals & Theatres",
    14: "Entertainment: Television",
    15: "Entertainment: Video Games",
    16: "Entertainment: Board Games",
    17: "Science & Nature",
    18: "Science: Computers",
    19: "Science: Mathematics",
    20: "Mythology",
    21: "Sports",
    22: "Geography",
    23: "History",
    24: "Politics",
    25: "Art",
    26: "Celebrities",
    27: "Animals",
    28: "Vehicles",
    29: "Entertainment: Comics",
    30: "Entertainment: Japanese Anime & Manga",
    31: "Entertainment: Cartoon & Animations",
    32: "Science: Gadgets",
}

# CommEazy theme mapping (must match questionBank.ts CATEGORY_THEME_MAP)
CATEGORY_THEME_MAP = {
    "General Knowledge": "general",
    "Entertainment: Books": "arts",
    "Entertainment: Film": "entertainment",
    "Entertainment: Music": "entertainment",
    "Entertainment: Musicals & Theatres": "arts",
    "Entertainment: Television": "entertainment",
    "Entertainment: Video Games": "entertainment",
    "Entertainment: Board Games": "entertainment",
    "Entertainment: Comics": "entertainment",
    "Entertainment: Japanese Anime & Manga": "entertainment",
    "Entertainment: Cartoon & Animations": "entertainment",
    "Science & Nature": "science",
    "Science: Computers": "science",
    "Science: Mathematics": "science",
    "Science: Gadgets": "science",
    "Mythology": "arts",
    "Sports": "sports",
    "Geography": "history",
    "History": "history",
    "Politics": "history",
    "Art": "arts",
    "Celebrities": "entertainment",
    "Animals": "animals",
    "Vehicles": "animals",
}

# Rate limit: 5 seconds between requests
RATE_LIMIT_SECONDS = 5.5  # slightly more than 5 to be safe
MAX_PER_REQUEST = 50

# ============================================================
# API Helpers
# ============================================================

def api_get(url: str) -> dict:
    """Make a GET request and return parsed JSON."""
    req = Request(url, headers={"User-Agent": "CommEazy-TriviaFetcher/1.0"})
    for attempt in range(3):
        try:
            with urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except (URLError, HTTPError) as e:
            print(f"  [ERROR] Request failed (attempt {attempt+1}/3): {e}")
            if attempt < 2:
                time.sleep(5)
    return {}


def get_session_token() -> str:
    """Request a new session token from OpenTDB."""
    data = api_get(TOKEN_URL)
    if data.get("response_code") == 0:
        token = data["token"]
        print(f"  Session token: {token[:20]}...")
        return token
    raise RuntimeError(f"Failed to get session token: {data}")


def reset_session_token(token: str) -> str:
    """Reset an existing session token."""
    data = api_get(RESET_TOKEN_URL.format(token))
    if data.get("response_code") == 0:
        print("  Session token reset.")
        return data.get("token", token)
    print("  Token reset failed, getting new token...")
    return get_session_token()


def make_question_key(q_text: str, correct: str) -> str:
    """Create a dedup key from question text + correct answer."""
    return f"{q_text.strip().lower()}|{correct.strip().lower()}"


# ============================================================
# Main Fetch Logic
# ============================================================

def fetch_all_questions() -> list[dict]:
    """
    Fetch all verified questions from OpenTDB API.

    Strategy:
    - Fetch per category (no difficulty filter) — maximizes questions per token
    - Session token prevents duplicates within one token session
    - Use a seen_keys set to deduplicate across token resets
    - After first pass, reset token and do a second pass for stragglers
    """
    print("=" * 60)
    print("OpenTDB Question Fetcher — CommEazy")
    print("=" * 60)

    # Get session token
    print("\n[1/4] Requesting session token...")
    token = get_session_token()

    all_questions = []
    seen_keys: set[str] = set()  # Dedup across token resets
    total_requests = 0

    def process_results(results: list[dict]) -> int:
        """Process API results, deduplicate, return count of new questions."""
        nonlocal all_questions, seen_keys
        new_count = 0
        for q in results:
            cat_name = html.unescape(unquote(q["category"]))
            correct = html.unescape(unquote(q["correct_answer"]))
            question_text = html.unescape(unquote(q["question"]))

            key = make_question_key(question_text, correct)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            theme = CATEGORY_THEME_MAP.get(cat_name, "general")
            question = {
                "id": "",  # Will be assigned after all fetching
                "category": cat_name,
                "theme": theme,
                "difficulty": unquote(q["difficulty"]),
                "question": question_text,
                "correctAnswer": correct,
                "incorrectAnswers": [
                    html.unescape(unquote(a))
                    for a in q["incorrect_answers"]
                ],
            }
            all_questions.append(question)
            new_count += 1
        return new_count

    # ============================================================
    # Pass 1: Fetch per category (no difficulty filter)
    # ============================================================

    print(f"\n[2/4] Pass 1 — Fetching per category ({len(CATEGORIES)} categories)...\n")

    cat_list = list(CATEGORIES.items())
    for idx, (cat_id, cat_name) in enumerate(cat_list, 1):
        cat_count = 0
        consecutive_empty = 0

        while True:
            url = (
                f"{API_BASE}?amount={MAX_PER_REQUEST}"
                f"&category={cat_id}"
                f"&type=multiple"
                f"&encode=url3986"
                f"&token={token}"
            )

            time.sleep(RATE_LIMIT_SECONDS)
            total_requests += 1

            data = api_get(url)
            rc = data.get("response_code", -1)

            if rc == 0:
                results = data.get("results", [])
                new = process_results(results)
                cat_count += new
                consecutive_empty = 0

                if len(results) < MAX_PER_REQUEST:
                    # Got fewer than requested — category likely exhausted
                    break

            elif rc == 4:
                # Token exhausted for this category
                break

            elif rc == 1:
                # No results for this category
                break

            elif rc == 5:
                # Rate limit — wait longer
                print(f"  [RATE LIMIT] Waiting 15s...")
                time.sleep(15)
                continue

            elif rc == 3:
                # Token expired — get new one
                print(f"  [TOKEN EXPIRED] Getting new token...")
                token = get_session_token()
                time.sleep(RATE_LIMIT_SECONDS)
                continue

            else:
                consecutive_empty += 1
                if consecutive_empty >= 2:
                    break

        print(f"  [{idx}/{len(CATEGORIES)}] {cat_name}: +{cat_count} (total: {len(all_questions)})")

    pass1_total = len(all_questions)
    print(f"\n  Pass 1 complete: {pass1_total} questions in {total_requests} requests")

    # ============================================================
    # Pass 2: Reset token, try again for any missed questions
    # ============================================================

    print(f"\n[3/4] Pass 2 — Resetting token for second sweep...\n")
    time.sleep(RATE_LIMIT_SECONDS)
    token = reset_session_token(token)

    for idx, (cat_id, cat_name) in enumerate(cat_list, 1):
        cat_count = 0

        while True:
            url = (
                f"{API_BASE}?amount={MAX_PER_REQUEST}"
                f"&category={cat_id}"
                f"&type=multiple"
                f"&encode=url3986"
                f"&token={token}"
            )

            time.sleep(RATE_LIMIT_SECONDS)
            total_requests += 1

            data = api_get(url)
            rc = data.get("response_code", -1)

            if rc == 0:
                results = data.get("results", [])
                new = process_results(results)
                cat_count += new

                # If no new unique questions, this category is truly exhausted
                if new == 0:
                    break
                if len(results) < MAX_PER_REQUEST:
                    break

            elif rc in (1, 4):
                break

            elif rc == 5:
                time.sleep(15)
                continue

            elif rc == 3:
                token = get_session_token()
                time.sleep(RATE_LIMIT_SECONDS)
                continue

            else:
                break

        if cat_count > 0:
            print(f"  [{idx}/{len(CATEGORIES)}] {cat_name}: +{cat_count} new (total: {len(all_questions)})")

    pass2_new = len(all_questions) - pass1_total
    print(f"\n  Pass 2 complete: +{pass2_new} new questions (total: {len(all_questions)})")

    # ============================================================
    # Assign sequential IDs
    # ============================================================

    print(f"\n[4/4] Assigning IDs and sorting...")

    # Sort by theme, then difficulty, then category for nice ordering
    diff_order = {"easy": 0, "medium": 1, "hard": 2}
    all_questions.sort(key=lambda q: (q["theme"], diff_order.get(q["difficulty"], 1), q["category"]))

    for i, q in enumerate(all_questions, 1):
        q["id"] = f"en-{i:04d}"

    print(f"\nDone! {len(all_questions)} unique questions fetched in {total_requests} API requests.")
    return all_questions


def save_trivia_json(questions: list[dict], output_path: str):
    """Save questions in CommEazy trivia JSON format."""
    data = {
        "version": "1.1",
        "language": "en",
        "questionCount": len(questions),
        "questions": questions,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    size_mb = len(json.dumps(data, ensure_ascii=False).encode("utf-8")) / (1024 * 1024)
    print(f"\nSaved to: {output_path}")
    print(f"File size: {size_mb:.2f} MB")
    print(f"Questions: {len(questions)}")

    # Stats per theme
    themes: dict[str, int] = {}
    for q in questions:
        themes[q["theme"]] = themes.get(q["theme"], 0) + 1
    print("\nPer theme:")
    for theme, count in sorted(themes.items(), key=lambda x: -x[1]):
        print(f"  {theme}: {count}")

    # Stats per difficulty
    diffs: dict[str, int] = {}
    for q in questions:
        diffs[q["difficulty"]] = diffs.get(q["difficulty"], 0) + 1
    print("\nPer difficulty:")
    for diff, count in sorted(diffs.items()):
        print(f"  {diff}: {count}")


# ============================================================
# Entry Point
# ============================================================

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "trivia-en.json")

    print(f"Output: {output_path}\n")

    questions = fetch_all_questions()

    if not questions:
        print("\n[ERROR] No questions fetched!")
        sys.exit(1)

    save_trivia_json(questions, output_path)

    print(f"\n{'=' * 60}")
    print("Next steps:")
    print("1. Translate trivia-en.json -> trivia-nl.json")
    print("2. Upload both to GitHub Release v1.1")
    print(f"{'=' * 60}")
