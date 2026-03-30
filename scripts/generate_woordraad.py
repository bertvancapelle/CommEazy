#!/usr/bin/env python3
"""
generate_woordraad.py — Woordraad Word List Generator

Generates word lists for CommEazy's Woordraad game by combining:
1. Hunspell dictionary — all valid 5-letter words (validGuesses)
2. OpenSubtitles frequency list — common words filter (targetWords)

Two-list architecture:
- targetWords: Hunspell ∩ OpenSubtitles top-5000 → common 5-letter words (~500-1500)
- validGuesses: all valid Hunspell 5-letter words (~8000-12000)

Output format (woordraad-{lang}.json):
{
  "language": "nl",
  "version": "1.0",
  "generated": "2026-03-30",
  "source": "hunspell+opensubtitles",
  "targetWords": ["bloem", "regen", "storm", ...],
  "validGuesses": ["bloem", "regen", "storm", "aback", ...]
}

Usage:
  python3 generate_woordraad.py --lang nl --hunspell nl_NL.dic --freq opensubtitles-nl-top5000.txt
  python3 generate_woordraad.py --lang nl --hunspell nl_NL.dic  # without freq list (all words as targets)

Requirements:
  pip install pyhunspell  # optional, for affix expansion
  # Or just use the .dic file directly (one word per line)

Data sources:
  Hunspell:        https://github.com/wooorm/dictionaries (npm dictionaries)
  OpenSubtitles:   https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/{lang}/{lang}_50k.txt
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path
from typing import Optional

# ============================================================
# Constants
# ============================================================

WORD_LENGTH = 5
VERSION = "1.0"

# OpenSubtitles frequency word lists (top 50k words per language)
FREQUENCY_LIST_URLS = {
    "nl": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/nl/nl_50k.txt",
    "en": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt",
    "de": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt",
    "fr": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt",
    "es": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt",
    "it": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/it/it_50k.txt",
    "pt": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt/pt_50k.txt",
    "no": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/no/no_50k.txt",
    "sv": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/sv/sv_50k.txt",
    "da": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/da/da_50k.txt",
    "pl": "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pl/pl_50k.txt",
}

# Hunspell dictionary download URLs (wooorm/dictionaries on GitHub)
HUNSPELL_URLS = {
    "nl": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/nl/index.dic",
    "en": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/en/index.dic",
    "de": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/de/index.dic",
    "fr": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/fr/index.dic",
    "es": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/es/index.dic",
    "it": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/it/index.dic",
    "pt": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/pt/index.dic",
    "no": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/nb/index.dic",
    "sv": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/sv/index.dic",
    "da": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/da/index.dic",
    "pl": "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/pl/index.dic",
}

# Top N frequency words to intersect with Hunspell for targetWords
DEFAULT_FREQ_TOP_N = 5000

# ============================================================
# Helpers
# ============================================================


def is_valid_word(word: str) -> bool:
    """Check if a word is a valid 5-letter word (only lowercase a-z ASCII letters).
    Excludes accented characters (é, ï, ĳ etc.) since the game keyboard is A-Z only."""
    return len(word) == WORD_LENGTH and word.isascii() and word.isalpha() and word.islower()


def download_file(url: str, label: str) -> str:
    """Download a file from URL and return its content as string."""
    print(f"  Downloading {label}...")
    print(f"  URL: {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CommEazy-Generator/1.0"})
        with urllib.request.urlopen(req, timeout=30) as response:
            content = response.read().decode("utf-8", errors="replace")
            print(f"  Downloaded {len(content)} bytes")
            return content
    except Exception as e:
        print(f"  ERROR: Failed to download {label}: {e}", file=sys.stderr)
        raise


def parse_hunspell_dic(content: str) -> set[str]:
    """
    Parse a Hunspell .dic file and extract all valid 5-letter words.

    Hunspell .dic format:
    - First line: word count (number)
    - Subsequent lines: word/flags (flags after / are affix indicators)
    - We strip flags and take the base word
    """
    words = set()
    lines = content.strip().splitlines()

    # Skip first line if it's just a number (word count)
    start = 0
    if lines and lines[0].strip().isdigit():
        start = 1

    for line in lines[start:]:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        # Strip affix flags: "woord/ABC" → "woord"
        word = line.split("/")[0].strip().lower()

        # Also strip tab-separated metadata
        word = word.split("\t")[0].strip()

        if is_valid_word(word):
            words.add(word)

    return words


def parse_frequency_list(content: str, top_n: int = DEFAULT_FREQ_TOP_N) -> list[str]:
    """
    Parse an OpenSubtitles frequency list.

    Format: "word frequency" (space-separated, one per line)
    Already sorted by frequency (most common first).
    """
    words = []
    for line in content.strip().splitlines():
        if not line.strip():
            continue
        parts = line.strip().split()
        if not parts:
            continue
        word = parts[0].lower()
        if is_valid_word(word):
            words.append(word)
        if len(words) >= top_n:
            break
    return words


def load_local_file(path: str) -> str:
    """Load a local file and return its content."""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ============================================================
# Main Generation Logic
# ============================================================


def generate_word_list(
    lang: str,
    hunspell_path: str | None = None,
    freq_path: str | None = None,
    freq_top_n: int = DEFAULT_FREQ_TOP_N,
    auto_download: bool = False,
) -> dict:
    """
    Generate a woordraad word list for a given language.

    Args:
        lang: Language code (e.g. 'nl', 'en')
        hunspell_path: Path to local Hunspell .dic file (optional if auto_download)
        freq_path: Path to local frequency list file (optional)
        freq_top_n: Number of top frequency words to use
        auto_download: Download Hunspell + frequency lists from GitHub

    Returns:
        Dictionary matching WoordraadWordData format
    """
    print(f"\n{'='*60}")
    print(f"Generating Woordraad word list for: {lang}")
    print(f"{'='*60}")

    # Step 1: Load Hunspell dictionary
    if hunspell_path:
        print(f"\n[1/3] Loading Hunspell dictionary from: {hunspell_path}")
        hunspell_content = load_local_file(hunspell_path)
    elif auto_download and lang in HUNSPELL_URLS:
        print(f"\n[1/3] Downloading Hunspell dictionary for '{lang}'...")
        hunspell_content = download_file(HUNSPELL_URLS[lang], f"Hunspell {lang}")
    else:
        print(f"ERROR: No Hunspell dictionary for '{lang}'. Provide --hunspell or use --auto-download.", file=sys.stderr)
        sys.exit(1)

    hunspell_words = parse_hunspell_dic(hunspell_content)
    print(f"  Found {len(hunspell_words)} valid {WORD_LENGTH}-letter words in Hunspell")

    # Step 2: Load frequency list (optional)
    freq_words = None
    if freq_path:
        print(f"\n[2/3] Loading frequency list from: {freq_path}")
        freq_content = load_local_file(freq_path)
        freq_words = parse_frequency_list(freq_content, freq_top_n)
        print(f"  Found {len(freq_words)} valid {WORD_LENGTH}-letter words in top {freq_top_n}")
    elif auto_download and lang in FREQUENCY_LIST_URLS:
        print(f"\n[2/3] Downloading frequency list for '{lang}'...")
        freq_content = download_file(FREQUENCY_LIST_URLS[lang], f"FrequencyWords {lang}")
        freq_words = parse_frequency_list(freq_content, freq_top_n)
        print(f"  Found {len(freq_words)} valid {WORD_LENGTH}-letter words in top {freq_top_n}")
    else:
        print(f"\n[2/3] No frequency list available — all Hunspell words will be targets")

    # Step 3: Compute target words and valid guesses
    print(f"\n[3/3] Computing word lists...")

    if freq_words:
        # targetWords = Hunspell ∩ frequency list (common words only)
        freq_set = set(freq_words)
        target_words = sorted(hunspell_words & freq_set)
        print(f"  targetWords (Hunspell ∩ frequency): {len(target_words)}")
    else:
        # Without frequency list, use all Hunspell words as targets
        target_words = sorted(hunspell_words)
        print(f"  targetWords (all Hunspell words): {len(target_words)}")

    # validGuesses = all Hunspell words (superset of targetWords)
    valid_guesses = sorted(hunspell_words)
    print(f"  validGuesses (all Hunspell words): {len(valid_guesses)}")

    # Sanity checks
    if len(target_words) < 100:
        print(f"  WARNING: Only {len(target_words)} target words — game may be too repetitive!", file=sys.stderr)
    if len(valid_guesses) < 500:
        print(f"  WARNING: Only {len(valid_guesses)} valid guesses — players may hit many 'invalid word' errors!", file=sys.stderr)

    result = {
        "language": lang,
        "version": VERSION,
        "generated": date.today().isoformat(),
        "source": "hunspell+opensubtitles" if freq_words else "hunspell",
        "targetWords": target_words,
        "validGuesses": valid_guesses,
    }

    return result


# ============================================================
# CLI
# ============================================================


def main():
    parser = argparse.ArgumentParser(
        description="Generate Woordraad word lists for CommEazy",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Auto-download everything for Dutch:
  python3 generate_woordraad.py --lang nl --auto-download

  # Use local Hunspell file:
  python3 generate_woordraad.py --lang nl --hunspell nl_NL.dic --auto-download

  # Use both local files:
  python3 generate_woordraad.py --lang nl --hunspell nl_NL.dic --freq nl_50k.txt

  # Generate for all supported languages:
  python3 generate_woordraad.py --all --auto-download

  # Custom output directory:
  python3 generate_woordraad.py --lang nl --auto-download --output ./game-data/
        """,
    )
    parser.add_argument("--lang", help="Language code (e.g. nl, en, de)")
    parser.add_argument("--hunspell", help="Path to Hunspell .dic file")
    parser.add_argument("--freq", help="Path to frequency word list file")
    parser.add_argument("--freq-top-n", type=int, default=DEFAULT_FREQ_TOP_N, help=f"Top N frequency words (default: {DEFAULT_FREQ_TOP_N})")
    parser.add_argument("--auto-download", action="store_true", help="Auto-download Hunspell + frequency lists from GitHub")
    parser.add_argument("--all", action="store_true", help="Generate for all supported languages")
    parser.add_argument("--output", default=".", help="Output directory (default: current directory)")

    args = parser.parse_args()

    if not args.lang and not args.all:
        parser.error("Either --lang or --all is required")

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    languages = list(HUNSPELL_URLS.keys()) if args.all else [args.lang]

    for lang in languages:
        result = generate_word_list(
            lang=lang,
            hunspell_path=args.hunspell if not args.all else None,
            freq_path=args.freq if not args.all else None,
            freq_top_n=args.freq_top_n,
            auto_download=args.auto_download or args.all,
        )

        output_file = output_dir / f"woordraad-{lang}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
            f.write("\n")

        file_size = output_file.stat().st_size
        print(f"\n  Output: {output_file} ({file_size / 1024:.1f} KB)")
        print(f"  targetWords: {len(result['targetWords'])}")
        print(f"  validGuesses: {len(result['validGuesses'])}")

    print(f"\n{'='*60}")
    print(f"Done! Generated {len(languages)} word list(s).")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
