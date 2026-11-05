"""Metamorphic transforms: label-free tests of the scorer's logic.

Relations the engine must satisfy (checked in run_eval.py):
  * shuffle_sections      -> score ~unchanged   (order of resume sections is not evidence)
  * inject_pii (redacted) -> score unchanged    (personal details must never move the score)
  * remove_evidence       -> score does not rise (deleting proof cannot help the candidate)
"""
import random
import re
from typing import List, Tuple

HEADING = re.compile(r"^\s*(#{1,4}\s+.+|[A-Z][A-Z &/]{3,40}:?|[A-Z][A-Za-z &/]{2,30}:)\s*$")

PLANTED_PII = [
    "jane.q.testperson@example.com", "+91 98765 43210", "linkedin.com/in/jane-testperson",
    "github.com/janetestperson", "Flat 12, Test Residency, MG Road, Pune 411001", "Jane Q Testperson",
]


def split_sections(text: str) -> List[str]:
    blocks, cur = [], []
    for line in text.splitlines():
        if HEADING.match(line) and cur:
            blocks.append("\n".join(cur))
            cur = []
        cur.append(line)
    if cur:
        blocks.append("\n".join(cur))
    return blocks


def shuffle_sections(text: str, seed: int = 0) -> str:
    blocks = split_sections(text)
    if len(blocks) < 3:
        return text
    head, rest = blocks[0], blocks[1:]
    random.Random(seed).shuffle(rest)
    return "\n".join([head] + rest)


def remove_evidence(text: str, term: str) -> Tuple[str, int]:
    """Drop every line mentioning `term` (case-insensitive). Returns (new_text, lines_removed)."""
    kept, removed = [], 0
    for line in text.splitlines():
        if re.search(re.escape(term), line, re.I):
            removed += 1
        else:
            kept.append(line)
    return "\n".join(kept), removed


def inject_pii(text: str) -> str:
    """Prepend a contact block + sensitive lines made of PLANTED_PII; redaction should erase all of it."""
    header = (f"{PLANTED_PII[5]}\n{PLANTED_PII[0]} | {PLANTED_PII[1]}\n{PLANTED_PII[2]} | {PLANTED_PII[3]}\n"
              f"{PLANTED_PII[4]}\nDate of Birth: 01/01/2003\nGender: Female\nMarital Status: Single\n")
    return header + text
