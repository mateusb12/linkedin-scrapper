from __future__ import annotations

import json
import re
import unicodedata
from collections.abc import Iterable
from hashlib import sha256

import numpy as np

NON_ALNUM_RE = re.compile(r"[^a-z0-9+#.\s]+")
SPACE_RE = re.compile(r"\s+")


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    ascii_value = ascii_value.lower()
    ascii_value = NON_ALNUM_RE.sub(" ", ascii_value)
    return SPACE_RE.sub(" ", ascii_value).strip()


def tokenize(value: str | None) -> list[str]:
    normalized = normalize_text(value)
    return [token for token in normalized.split(" ") if token]


def parse_jsonish_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []
        if stripped.startswith("[") and stripped.endswith("]"):
            try:
                decoded = json.loads(stripped)
            except json.JSONDecodeError:
                return [stripped]
            if isinstance(decoded, list):
                return [str(item).strip() for item in decoded if str(item).strip()]
        return [part.strip() for part in stripped.split(",") if part.strip()]
    return [str(value).strip()]


def count_phrase_matches(text: str, phrases: Iterable[str]) -> list[str]:
    normalized = normalize_text(text)
    matches: list[str] = []
    for phrase in phrases:
        normalized_phrase = normalize_text(phrase)
        if normalized_phrase and normalized_phrase in normalized:
            matches.append(phrase)
    return matches


def tokens_near_each_other(
    text: str,
    left_terms: Iterable[str],
    right_terms: Iterable[str],
    window: int = 5,
) -> bool:
    tokens = tokenize(text)
    left = {normalize_text(term) for term in left_terms}
    right = {normalize_text(term) for term in right_terms}
    for index, token in enumerate(tokens):
        if token not in left:
            continue
        neighborhood = tokens[max(0, index - window): index + window + 1]
        if any(candidate in right for candidate in neighborhood):
            return True
    return False


def best_fuzzy_overlap(text: str, phrases: Iterable[str]) -> tuple[float, str | None]:
    text_tokens = set(tokenize(text))
    best_score = 0.0
    best_phrase: str | None = None
    for phrase in phrases:
        phrase_tokens = set(tokenize(phrase))
        if not phrase_tokens:
            continue
        overlap = len(text_tokens & phrase_tokens) / len(phrase_tokens)
        if overlap > best_score:
            best_score = overlap
            best_phrase = phrase
    return best_score, best_phrase


def extract_evidence_snippets(
    text: str,
    terms: Iterable[str],
    *,
    limit: int = 4,
    radius: int = 90,
) -> list[str]:
    raw_text = text or ""
    normalized = normalize_text(raw_text)
    evidence: list[str] = []
    for term in terms:
        normalized_term = normalize_text(term)
        if not normalized_term:
            continue
        idx = normalized.find(normalized_term)
        if idx < 0:
            continue
        start = max(0, idx - radius)
        end = min(len(raw_text), idx + len(term) + radius)
        snippet = raw_text[start:end].strip().replace("\n", " ")
        if snippet and snippet not in evidence:
            evidence.append(snippet)
        if len(evidence) >= limit:
            break
    return evidence


def stable_hash_embedding(
    text: str,
    *,
    dims: int = 256,
    include_bigrams: bool = True,
) -> np.ndarray:
    tokens = tokenize(text)
    vector = np.zeros(dims, dtype=float)
    if not tokens:
        return vector

    grams = list(tokens)
    if include_bigrams and len(tokens) > 1:
        grams.extend(
            f"{tokens[index]}_{tokens[index + 1]}"
            for index in range(len(tokens) - 1)
        )

    for gram in grams:
        digest = sha256(gram.encode("utf-8")).digest()
        bucket = int.from_bytes(digest[:4], "big") % dims
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[bucket] += sign

    norm = np.linalg.norm(vector)
    return vector if norm == 0 else vector / norm


def cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    left_norm = np.linalg.norm(left)
    right_norm = np.linalg.norm(right)
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return float(np.dot(left, right) / (left_norm * right_norm))

