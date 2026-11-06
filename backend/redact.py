"""Local PII redaction. Runs BEFORE resume text is stored or sent to any LLM.

Removes direct identifiers (name, contact details, links, addresses, government
IDs) and attributes that invite bias (age/DOB, gender, marital status,
nationality, photos' captions). Keeps skills, employers, schools and dates so
the screening still works.

Best-effort, rule-based + spaCy NER: it reduces exposure, it does not guarantee
anonymity. The UI says so.
"""
import re
from collections import Counter
from typing import Dict, List, Optional, Tuple

EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
URL = re.compile(r"(?:https?://|www\.)\S+|\b(?:linkedin\.com|github\.com|gitlab\.com|bitbucket\.org|twitter\.com|x\.com|medium\.com)/\S*", re.I)
PHONE = re.compile(r"(?<![\w/])(?:\+?\d{1,3}[\s.\-]?)?(?:\(\d{2,4}\)[\s.\-]?)?\d{2,5}[\s.\-]?\d{3,5}[\s.\-]?\d{3,5}(?![\w/])")
US_PHONE = re.compile(r"(?<![\w/])\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}(?![\w/])")
AADHAAR = re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b")
PAN = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
SSN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
PASSPORT = re.compile(r"\bpassport\s*(?:no\.?|number|#)?\s*[:\-]?\s*[A-Z0-9]{6,9}\b", re.I)
POSTCODE = re.compile(r"\b(?:\d{6}|\d{5}(?:-\d{4})?|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b")
STREET = re.compile(
    r"\b\d{1,5}[A-Za-z]?(?:[,\-/]\s*\d+)*\s+[A-Za-z0-9.' ]{2,40}?\s"
    r"(?:street|st|road|rd|avenue|ave|lane|ln|nagar|colony|sector|block|drive|dr|boulevard|blvd|marg|cross|main)\b\.?[^\n]*",
    re.I,
)
HOUSE = re.compile(r"\b(?:flat|house|door|plot|apt|apartment|villa)\.?\s*(?:no\.?|#)?\s*\d+[^\n]*|(?<!\w)#\s?\d+[^\n]*", re.I)
# Whole lines that only exist to state a protected / identifying attribute.
SENSITIVE_LINE = re.compile(
    r"^\s*(?:date of birth|dob|d\.o\.b|birth\s?date|born|age|gender|sex|marital status|nationality|religion|"
    r"caste|father'?s? name|mother'?s? name|spouse|address|permanent address|current address|"
    r"languages? known|visa status|photo)\b.*$",
    re.I | re.M,
)
TITLE_CASE_NAME = re.compile(r"^[A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-.]+){1,3}$")


def _header_lines(text: str, n: int = 6):
    out, count = [], 0
    for line in text.splitlines():
        if line.strip():
            out.append(line)
            count += 1
            if count >= n:
                break
    return out


GENERIC_LOCALS = {"info", "contact", "hello", "mail", "admin", "career", "careers", "work", "hire", "me", "official", "email"}


def _names_from_email(text: str) -> List[str]:
    """asha.rao@x.com -> ['asha', 'rao']: tokens that identify the candidate elsewhere in the text."""
    out: List[str] = []
    m = EMAIL.search(text)
    if m:
        local = m.group().split("@")[0].lower()
        if local not in GENERIC_LOCALS:
            for tok in re.split(r"[._\-+0-9]+", local):
                if len(tok) >= 3 and tok not in GENERIC_LOCALS and tok not in TECH_ALLOW:
                    out.append(tok)
    return out


def _find_name(text: str, nlp) -> Optional[str]:
    """Name = PERSON entity in the header, else a short Title-Case first line."""
    header = "\n".join(_header_lines(text, 4))
    if nlp is not None and header:
        for ent in nlp(header[:400]).ents:
            if ent.label_ == "PERSON" and 3 <= len(ent.text) <= 40 and "\n" not in ent.text.strip():
                return ent.text.strip()
    first = next((l.strip() for l in text.splitlines() if l.strip()), "")
    # "# CV -- Asha Rao", "Resume: Asha Rao", "**Name:** Asha Rao" -> "Asha Rao"
    first = re.sub(r"^[#*\s]+", "", first)
    first = re.sub(r"^(?:cv|resume|curriculum vitae|name)\s*[*]*\s*(?:[:\-\u2013\u2014|]+\s*)+[*]*\s*", "", first, flags=re.I).strip(" *")
    lead = re.split(r"\s+[-\u2013\u2014|]\s+|\s*,\s+|\s*\|\s*", first)[0].strip()
    if lead != first and TITLE_CASE_NAME.match(lead) and not re.search(r"\d|resume|curriculum|vitae", lead, re.I):
        return lead
    first = first if TITLE_CASE_NAME.match(first) else ""
    if TITLE_CASE_NAME.match(first) and not re.search(r"\d|resume|curriculum|vitae|engineer|developer", first, re.I):
        return first
    return None


TECH_ALLOW = {
    "flask", "django", "react", "angular", "vue", "node", "node.js", "spring", "rails", "express", "next",
    "swift", "rust", "go", "ruby", "dart", "flutter", "ember", "jasmine", "mocha", "bootstrap", "kafka",
    "spark", "hadoop", "airflow", "docker", "kubernetes", "lambda", "aws", "azure", "gcp", "mongo", "oracle",
    "unity", "unreal", "tableau", "excel", "java", "python", "scala", "kotlin", "laravel", "symfony",
}
NON_CONTACT = re.compile(r"\b(skills?|technolog|languages?|tools?|frameworks?|summary|objective|experience|projects?)\b", re.I)


CITY_STATE = re.compile(r"\b[A-Z][a-z]+(?: [A-Z][a-z]+){0,2},\s*(?:[A-Z][a-z]+(?: [A-Z][a-z]+){0,2}|[A-Z]{2})\b")
TITLE_SEG = re.compile(r"^[A-Z][a-z]+(?: [A-Z][a-z]+){0,2}$")
PLACEHOLDER = re.compile(r"\[(?:EMAIL|PHONE|LINK|NAME|ADDRESS|POSTCODE)\]")


def _redact_header_locations_heuristic(s: str, counts) -> str:
    """No-NER location removal, limited to contact-style header lines (never skills/experience)."""
    lines = s.split("\n")
    seen = 0
    for i, line in enumerate(lines):
        if not line.strip():
            continue
        seen += 1
        if seen > 5:
            break
        if NON_CONTACT.search(line) or len(line) > 140:
            continue
        contact_like = bool(PLACEHOLDER.search(line)) or bool(re.search(r"\b\d{5,6}\b", line)) or CITY_STATE.search(line)
        if not contact_like:
            continue
        def city_state(m):
            if m.group().split(",")[0].strip().lower() in TECH_ALLOW:
                return m.group()
            counts["location"] += 1
            return "[LOCATION]"
        lines[i] = CITY_STATE.sub(city_state, lines[i])
        # "Pune | [EMAIL] | [PHONE]": a lone Title-Case segment next to contact placeholders is a place.
        if PLACEHOLDER.search(lines[i]):
            parts = re.split(r"(\s*[|•·]\s*)", lines[i])
            for j, part in enumerate(parts):
                t = part.strip()
                if TITLE_SEG.match(t) and t.lower() not in TECH_ALLOW and not PLACEHOLDER.search(t):
                    parts[j] = part.replace(t, "[LOCATION]")
                    counts["location"] += 1
            lines[i] = "".join(parts)
    return "\n".join(lines)


def _redact_header_locations(s: str, nlp, counts) -> str:
    """City/state in the first contact-style lines only (never skills/experience lines)."""
    if nlp is None:
        return _redact_header_locations_heuristic(s, counts)
    lines = s.split("\n")
    seen = 0
    for i, line in enumerate(lines):
        if not line.strip():
            continue
        seen += 1
        if seen > 5:
            break
        if NON_CONTACT.search(line) or len(line) > 140:
            continue
        for ent in nlp(line).ents:
            t = ent.text.strip()
            if ent.label_ == "GPE" and t.lower() not in TECH_ALLOW and len(t) > 2:
                lines[i] = re.sub(re.escape(t), "[LOCATION]", lines[i])
                counts["location"] += 1
    return "\n".join(lines)


def redact(text: str, nlp=None) -> Tuple[str, Dict[str, int]]:
    """Return (redacted_text, counts of what was removed)."""
    counts: Counter = Counter()

    def sub(pattern, label, s, key=None):
        def r(_m):
            counts[key or label] += 1
            return f"[{label}]"
        return pattern.sub(r, s)

    s = text

    # Whole lines stating protected / identifying attributes first (before other rules chop them).
    def drop_line(m):
        counts["personal details line"] += 1
        return ""
    s = SENSITIVE_LINE.sub(drop_line, s)

    name = _find_name(s, nlp)
    s = sub(EMAIL, "EMAIL", s, "email")
    s = sub(URL, "LINK", s, "link")
    s = sub(AADHAAR, "ID", s, "government ID")
    s = sub(PAN, "ID", s, "government ID")
    s = sub(SSN, "ID", s, "government ID")
    s = sub(PASSPORT, "ID", s, "government ID")
    s = sub(HOUSE, "ADDRESS", s, "address")
    s = sub(STREET, "ADDRESS", s, "address")

    def phone(m):
        digits = re.sub(r"\D", "", m.group())
        if 8 <= len(digits) <= 15 and not re.fullmatch(r"(19|20)\d{2}\D*(19|20)?\d{0,2}", m.group().strip()):
            counts["phone"] += 1
            return "[PHONE]"
        return m.group()
    s = US_PHONE.sub(lambda m: (counts.update(["phone"]) or "[PHONE]"), s)
    s = PHONE.sub(phone, s)

    email_names = _names_from_email(text)
    if name or email_names:
        parts = [p for p in re.split(r"\s+", name or "") if len(p) > 2]
        cands = ([name] if name else []) + parts + email_names
        pat = re.compile(r"\b(?:" + "|".join(re.escape(p) for p in dict.fromkeys(cands)) + r")\b", re.I)
        n = len(pat.findall(s))
        if n:
            counts["name"] += n
            s = pat.sub("[NAME]", s)

    s = _redact_header_locations(s, nlp, counts)

    # Postcodes only on address/location lines, so "100000 requests" survives.
    def line_postcode(line):
        if "[LOCATION]" in line or "[ADDRESS]" in line or re.search(r"\b(?:address|city|pin)\b", line, re.I):
            return POSTCODE.sub(lambda m: (counts.update(["postcode"]) or "[POSTCODE]"), line)
        return line

    s = "\n".join(line_postcode(l) for l in s.split("\n"))
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip(), dict(counts)


def summarize(counts: Dict[str, int]) -> str:
    if not counts:
        return "No personal details detected."
    return "Removed: " + ", ".join(f"{v} {k}" for k, v in counts.items())
