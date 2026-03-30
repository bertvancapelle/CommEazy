#!/usr/bin/env python3
"""
Translate trivia-en.json to trivia-nl.json using Anthropic API.

Zero external dependencies — uses only stdlib urllib.

Strategy:
- Process questions in batches of 25
- Use Claude Sonnet for speed and quality
- Preserve: IDs, categories, themes, difficulties
- Translate: question, correctAnswer, incorrectAnswers
- Save progress incrementally (resume-capable via checkpoint file)
- Retry failed batches up to 3 times

Usage:
    python3 translate_to_dutch.py YOUR_ANTHROPIC_API_KEY

Resume after interruption:
    python3 translate_to_dutch.py YOUR_ANTHROPIC_API_KEY
    # Automatically picks up from checkpoint
"""

import json
import os
import sys
import time
import re
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# ============================================================
# Configuration
# ============================================================

BATCH_SIZE = 25           # Questions per API call
MODEL = "claude-3-5-sonnet-20241022"  # Widely available, good quality
MAX_RETRIES = 3           # Retries per batch
RATE_LIMIT_DELAY = 1.0    # Seconds between API calls
API_URL = "https://api.anthropic.com/v1/messages"

INPUT_FILE = "trivia-en.json"
OUTPUT_FILE = "trivia-nl.json"
CHECKPOINT_FILE = "translate_checkpoint.json"

# ============================================================
# Translation Prompt
# ============================================================

SYSTEM_PROMPT = """You are a professional English-to-Dutch translator specializing in trivia questions.

RULES:
1. Translate ALL text naturally into Dutch
2. Keep proper nouns in their original form (e.g., "Shakespeare" stays "Shakespeare", "Paris" stays "Paris")
3. Numbers that are answers should stay as numbers (e.g., "28" stays "28")
4. Translate measurement units to metric if applicable
5. Cultural references should be preserved but translated naturally
6. Keep the same tone — these are trivia questions for a family app used by seniors
7. Category names stay in ENGLISH (they are metadata, not shown to users)
8. DO NOT add or remove questions — translate exactly what is given
9. Scientific/Latin names stay unchanged
10. Return ONLY valid JSON — no markdown, no explanation, no code blocks

OUTPUT FORMAT:
Return a JSON array of translated question objects. Each object has:
- "id": same as input (unchanged)
- "question": translated to Dutch
- "correctAnswer": translated to Dutch
- "incorrectAnswers": array of 3 translated answers

Example input:
[{"id": "en-0001", "question": "What is the capital of France?", "correctAnswer": "Paris", "incorrectAnswers": ["London", "Berlin", "Madrid"]}]

Example output:
[{"id": "en-0001", "question": "Wat is de hoofdstad van Frankrijk?", "correctAnswer": "Parijs", "incorrectAnswers": ["Londen", "Berlijn", "Madrid"]}]"""

# ============================================================
# Helpers
# ============================================================

def get_script_dir() -> str:
    return os.path.dirname(os.path.abspath(__file__))


def load_checkpoint() -> dict:
    """Load translation checkpoint if exists."""
    path = os.path.join(get_script_dir(), CHECKPOINT_FILE)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"translated": {}, "last_batch": -1}


def save_checkpoint(checkpoint: dict):
    """Save translation progress."""
    path = os.path.join(get_script_dir(), CHECKPOINT_FILE)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f, ensure_ascii=False)


def extract_json_from_response(text: str) -> list:
    """Extract JSON array from Claude's response, handling potential markdown wrapping."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*\n?', '', text)
        text = re.sub(r'\n?```\s*$', '', text)
        text = text.strip()
    return json.loads(text)


def call_anthropic_api(api_key: str, system: str, user_message: str) -> str:
    """Call Anthropic Messages API using urllib (no dependencies)."""
    payload = json.dumps({
        "model": MODEL,
        "max_tokens": 8192,
        "system": system,
        "messages": [{"role": "user", "content": user_message}],
    }).encode("utf-8")

    req = Request(
        API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body["content"][0]["text"]
    except HTTPError as e:
        # Read the error response body for diagnostics
        error_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {error_body[:500]}") from e


def translate_batch(api_key: str, questions: list) -> list:
    """Translate a batch of questions using Claude API."""
    batch_input = []
    for q in questions:
        batch_input.append({
            "id": q["id"],
            "question": q["question"],
            "correctAnswer": q["correctAnswer"],
            "incorrectAnswers": q["incorrectAnswers"],
        })

    user_message = (
        f"Translate these {len(batch_input)} trivia questions to Dutch. "
        f"Return ONLY a JSON array.\n\n"
        f"{json.dumps(batch_input, ensure_ascii=False)}"
    )

    for attempt in range(MAX_RETRIES):
        try:
            result_text = call_anthropic_api(api_key, SYSTEM_PROMPT, user_message)
            translated = extract_json_from_response(result_text)

            # Validate response
            if not isinstance(translated, list):
                raise ValueError("Response is not a JSON array")
            if len(translated) != len(questions):
                raise ValueError(
                    f"Expected {len(questions)} questions, got {len(translated)}"
                )

            for i, tq in enumerate(translated):
                if tq["id"] != questions[i]["id"]:
                    raise ValueError(
                        f"ID mismatch: expected {questions[i]['id']}, got {tq['id']}"
                    )
                if (
                    not isinstance(tq.get("incorrectAnswers"), list)
                    or len(tq["incorrectAnswers"]) != 3
                ):
                    raise ValueError(
                        f"Question {tq['id']}: expected 3 incorrect answers"
                    )

            return translated

        except Exception as e:
            print(f"    [RETRY {attempt+1}/{MAX_RETRIES}] Error: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** (attempt + 1))

    raise RuntimeError(f"Failed to translate batch after {MAX_RETRIES} attempts")


# ============================================================
# Main
# ============================================================

def main():
    if len(sys.argv) < 2:
        # Try environment variable as fallback
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            print("Usage: python3 translate_to_dutch.py YOUR_ANTHROPIC_API_KEY")
            print("   or: ANTHROPIC_API_KEY=sk-... python3 translate_to_dutch.py")
            sys.exit(1)
    else:
        api_key = sys.argv[1]

    script_dir = get_script_dir()
    input_path = os.path.join(script_dir, INPUT_FILE)
    output_path = os.path.join(script_dir, OUTPUT_FILE)
    checkpoint_path = os.path.join(script_dir, CHECKPOINT_FILE)

    print("=" * 60)
    print("Trivia Translation — English → Dutch")
    print("=" * 60)

    # Load input
    print(f"\nLoading {input_path}...")
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = data["questions"]
    total = len(questions)
    print(f"Total questions to translate: {total}")

    # Load checkpoint
    checkpoint = load_checkpoint()
    translated_map = checkpoint["translated"]
    start_batch = checkpoint["last_batch"] + 1

    already_done = len(translated_map)
    if already_done > 0:
        print(f"Resuming from checkpoint: {already_done}/{total} already translated")

    # Process in batches
    batches = []
    for i in range(0, total, BATCH_SIZE):
        batches.append(questions[i:i + BATCH_SIZE])

    total_batches = len(batches)
    print(f"\nProcessing {total_batches} batches of {BATCH_SIZE} questions each...\n")

    failed_batches = []

    for batch_idx in range(start_batch, total_batches):
        batch = batches[batch_idx]

        # Skip if all questions in this batch are already translated
        all_done = all(q["id"] in translated_map for q in batch)
        if all_done:
            continue

        try:
            translated = translate_batch(api_key, batch)

            for tq in translated:
                translated_map[tq["id"]] = tq

            checkpoint["translated"] = translated_map
            checkpoint["last_batch"] = batch_idx
            save_checkpoint(checkpoint)

            done_count = len(translated_map)
            pct = (done_count / total) * 100
            print(
                f"  [{batch_idx + 1}/{total_batches}] "
                f"Translated {len(translated)} questions "
                f"(total: {done_count}/{total} = {pct:.1f}%)"
            )

            time.sleep(RATE_LIMIT_DELAY)

        except Exception as e:
            print(f"  [{batch_idx + 1}/{total_batches}] FAILED: {e}")
            failed_batches.append(batch_idx)
            continue

    # Report failures
    if failed_batches:
        print(f"\n⚠️  {len(failed_batches)} batches failed: {failed_batches}")
        print("Re-run the script to retry failed batches.")

    # Build output
    print(f"\nBuilding output file...")

    nl_questions = []
    missing = []

    for q in questions:
        qid = q["id"]
        if qid in translated_map:
            tq = translated_map[qid]
            nl_q = {
                "id": qid.replace("en-", "nl-"),
                "category": q["category"],
                "theme": q["theme"],
                "difficulty": q["difficulty"],
                "question": tq["question"],
                "correctAnswer": tq["correctAnswer"],
                "incorrectAnswers": tq["incorrectAnswers"],
            }
            nl_questions.append(nl_q)
        else:
            missing.append(qid)

    if missing:
        print(f"⚠️  {len(missing)} questions not translated (will be excluded)")
        for mid in missing[:10]:
            print(f"    - {mid}")
        if len(missing) > 10:
            print(f"    ... and {len(missing) - 10} more")

    # Save output
    output_data = {
        "version": data["version"],
        "language": "nl",
        "questionCount": len(nl_questions),
        "questions": nl_questions,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\n✅ Saved to: {output_path}")
    print(f"   Questions: {len(nl_questions)}")
    print(f"   File size: {size_mb:.2f} MB")

    # Stats
    themes = {}
    diffs = {}
    for q in nl_questions:
        themes[q["theme"]] = themes.get(q["theme"], 0) + 1
        diffs[q["difficulty"]] = diffs.get(q["difficulty"], 0) + 1

    print("\nPer theme:")
    for theme, count in sorted(themes.items(), key=lambda x: -x[1]):
        print(f"  {theme}: {count}")

    print("\nPer difficulty:")
    for diff, count in sorted(diffs.items()):
        print(f"  {diff}: {count}")

    # Cleanup checkpoint on success
    if not missing and not failed_batches:
        if os.path.exists(checkpoint_path):
            os.remove(checkpoint_path)
        print(f"\n✅ All {total} questions translated. Checkpoint cleaned up.")
    else:
        print(f"\n⚠️  Checkpoint kept for resume. Re-run to complete.")

    print(f"\n{'=' * 60}")
    print("Next steps:")
    print("1. Validate trivia-nl.json")
    print("2. Upload both to GitHub Release v1.1")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
