from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

DEFAULT_LANGUAGETOOL_URL = "https://api.languagetool.org/v2/check"

LANGUAGE_ALIASES = {
    "english": "en-US",
    "enus": "en-US",
    "engb": "en-GB",
    "hindi": "hi-IN",
    "spanish": "es",
    "french": "fr",
    "german": "de-DE",
    "deutsch": "de-DE",
}


def normalize_language_code(language: str | None) -> str:
    if not language:
        return "auto"

    raw_value = str(language).strip()
    if not raw_value:
        return "auto"

    cleaned = raw_value.replace("_", "-")
    lowered = re.sub(r"[^a-zA-Z]", "", cleaned).lower()

    if lowered in LANGUAGE_ALIASES:
        return LANGUAGE_ALIASES[lowered]

    if re.fullmatch(r"[a-z]{2}(?:-[A-Z]{2})?", cleaned):
        parts = cleaned.split("-")
        if len(parts) == 2:
            return f"{parts[0].lower()}-{parts[1].upper()}"
        return cleaned.lower()

    return "auto"


def _normalize_enum_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value).lower())


def resolve_enum_value(
    desired_values: list[str],
    allowed_values: list[str] | tuple[str, ...] | None,
    fallback_values: list[str] | None = None,
) -> str:
    allowed = list(allowed_values or [])
    if not allowed:
        return desired_values[0]

    normalized_allowed = {_normalize_enum_key(value): value for value in allowed}

    for candidate in [*(desired_values or []), *(fallback_values or [])]:
        normalized_candidate = _normalize_enum_key(candidate)
        if normalized_candidate in normalized_allowed:
            return normalized_allowed[normalized_candidate]

    return allowed[0]


def classify_issue_type(match: dict, allowed_values: list[str] | None = None) -> str:
    rule = match.get("rule") or {}
    category = rule.get("category") or {}
    fingerprint = " ".join(
        filter(
            None,
            [
                str(rule.get("id") or ""),
                str(rule.get("issueType") or ""),
                str(category.get("id") or ""),
                str(category.get("name") or ""),
                str(match.get("message") or ""),
            ],
        )
    ).lower()

    if any(keyword in fingerprint for keyword in ("spell", "misspell", "typo", "orthograph")):
        return resolve_enum_value(
            ["SPELLING"],
            allowed_values,
            fallback_values=["GRAMMAR"],
        )

    if any(keyword in fingerprint for keyword in ("punct", "comma", "apostrophe", "quotation", "quote")):
        return resolve_enum_value(
            ["PUNCTUATION"],
            allowed_values,
            fallback_values=["FORMATTING", "GRAMMAR"],
        )

    if any(keyword in fingerprint for keyword in ("style", "whitespace", "capital", "typograph", "format")):
        return resolve_enum_value(
            ["FORMATTING"],
            allowed_values,
            fallback_values=["GRAMMAR"],
        )

    if any(keyword in fingerprint for keyword in ("term", "brand", "consisten")):
        return resolve_enum_value(
            ["CONSISTENCY"],
            allowed_values,
            fallback_values=["GRAMMAR", "FORMATTING"],
        )

    return resolve_enum_value(["GRAMMAR"], allowed_values, fallback_values=["FORMATTING"])


def classify_severity(match: dict, issue_type: str, allowed_values: list[str] | None = None) -> str:
    rule = match.get("rule") or {}
    fingerprint = " ".join(
        filter(
            None,
            [
                str(rule.get("id") or ""),
                str(rule.get("issueType") or ""),
                str(match.get("message") or ""),
            ],
        )
    ).lower()

    normalized_issue_type = _normalize_enum_key(issue_type)

    if any(keyword in fingerprint for keyword in ("unpaired", "not closed", "missing closing", "forbidden")):
        desired = ["CRITICAL", "ERROR"]
    elif normalized_issue_type in {"spelling", "typo", "orthography", "grammar"}:
        desired = ["ERROR", "WARNING"]
    elif normalized_issue_type in {"punctuation", "consistency", "terminology"}:
        desired = ["WARNING", "ERROR"]
    else:
        desired = ["INFO", "WARNING"]

    return resolve_enum_value(desired, allowed_values, fallback_values=["ERROR", "WARNING", "INFO", "CRITICAL"])


def extract_suggestion(match: dict, max_suggestions: int = 3) -> str | None:
    replacements = match.get("replacements") or []
    values: list[str] = []

    for replacement in replacements[:max_suggestions]:
        replacement_value = str(replacement.get("value") or "").strip()
        if replacement_value and replacement_value not in values:
            values.append(replacement_value)

    return "; ".join(values) if values else None


def call_languagetool(
    text: str,
    language: str,
    api_url: str | None = None,
    timeout: int = 20,
) -> dict:
    payload = urllib.parse.urlencode(
        {
            "text": text,
            "language": normalize_language_code(language),
            "enabledOnly": "false",
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        api_url or DEFAULT_LANGUAGETOOL_URL,
        data=payload,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "AI-4-Real Validation Service",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"LanguageTool request failed ({error.code}): {details}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"LanguageTool is unreachable: {error.reason}") from error


def build_validation_rows(
    segments: list[dict],
    document_id: int,
    language: str,
    allowed_issue_types: list[str] | None = None,
    allowed_severities: list[str] | None = None,
    api_url: str | None = None,
    max_suggestions: int = 3,
) -> tuple[list[dict], dict]:
    rows: list[dict] = []
    issues_by_type: Counter = Counter()
    issues_by_severity: Counter = Counter()
    failed_segments = 0
    skipped_segments = 0
    segments_with_issues: set[int] = set()
    total_segments = len(segments)

    for index, segment in enumerate(segments, start=1):
        segment_id = int(segment["id"])
        text = str(segment.get("source_text") or "").strip()
        preview = text.replace("\n", " ")[:80]

        print(f'[{index}/{total_segments}] segment_{segment_id}: "{preview}"')

        if not text:
            skipped_segments += 1
            print("        > skipped (empty)")
            continue

        try:
            response = call_languagetool(text=text, language=language, api_url=api_url)
        except Exception as error:
            failed_segments += 1
            print(f"        > failed: {error}")
            continue

        matches = response.get("matches") or []
        if not matches:
            print("        > clean")
            continue

        for match in matches:
            issue_type = classify_issue_type(match, allowed_issue_types)
            severity = classify_severity(match, issue_type, allowed_severities)
            offset_start = int(match.get("offset") or 0)
            length = max(int(match.get("length") or 0), 0)
            offset_end = offset_start + length
            problem_text = text[offset_start:offset_end].strip()
            message = str(match.get("message") or "LanguageTool detected a possible issue.").strip()
            suggestion = extract_suggestion(match, max_suggestions=max_suggestions)

            rows.append(
                {
                    "segment_id": segment_id,
                    "document_id": document_id,
                    "type": issue_type,
                    "severity": severity,
                    "message": message,
                    "offset_start": offset_start,
                    "offset_end": offset_end,
                    "suggestion": suggestion,
                    "resolved_by": None,
                }
            )

            issues_by_type[issue_type] += 1
            issues_by_severity[severity] += 1
            segments_with_issues.add(segment_id)

            print(f"        [{severity}] {issue_type}")
            print(f"        Message    : {message}")
            if problem_text:
                print(f'        Wrong text : "{problem_text}" (pos {offset_start}-{offset_end})')
            if suggestion:
                print(f"        Suggestion : {suggestion}")

    summary = {
        "checked_segments": total_segments,
        "issue_count": len(rows),
        "inserted_count": len(rows),
        "failed_segments": failed_segments,
        "skipped_segments": skipped_segments,
        "clean_segments": total_segments - failed_segments - skipped_segments - len(segments_with_issues),
        "issues_by_type": dict(issues_by_type),
        "issues_by_severity": dict(issues_by_severity),
    }

    return rows, summary
