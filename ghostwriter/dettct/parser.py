"""Parsers for DeTT&CT YAML administration files.

DeTT&CT (https://github.com/rabobank-cdc/DeTTECT) produces three types of YAML
administration files. Vanguard reads those files (PRD 1.1 / SETUP.md 11) and
normalizes them into a single JSON payload stored on :model:`dettct.DeTTCTRun`.

Supported file types:

* ``data-source-administration`` — lists available data sources and their
  quality scores (data-source visibility).
* ``techniques-administration`` — lists ATT&CK techniques with detection and
  visibility scores.
* ``group-administration`` — lists threat actor groups and the techniques they
  are known to use (threat-group TTPs).

The parser is intentionally tolerant of version differences between DeTT&CT
releases: it reads whatever keys are present and normalizes them into a stable
structure that the views can render.
"""

# Standard Libraries
import json
import logging
from datetime import datetime, timezone

# 3rd Party Libraries
import yaml

# Using __name__ resolves to ghostwriter.dettct.parser
logger = logging.getLogger(__name__)


def parse_timestamp(value):
    """Best-effort conversion of a DeTT&CT date/timestamp value to an ISO string."""
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
    # Assume date objects or YYYY-MM-DD strings; convert to midnight UTC
    try:
        return datetime.fromisoformat(str(value)).replace(tzinfo=timezone.utc).isoformat()
    except (TypeError, ValueError):
        return str(value)


def latest_score(score_logbook):
    """Return the most recent score from a DeTT&CT ``score_logbook``."""
    if not isinstance(score_logbook, list):
        return None
    entries = []
    for entry in score_logbook:
        if isinstance(entry, dict):
            entries.append((parse_timestamp(entry.get("date")), entry.get("score")))
    entries.sort(key=lambda item: item[0] or "")
    return entries[-1][1] if entries else None


def parse_data_source_administration(data):
    """Normalize a ``data-source-administration`` file payload."""
    data_sources = []
    for entry in data.get("data_sources") or []:
        if not isinstance(entry, dict):
            continue
        name = entry.get("data_source_name") or entry.get("name") or "Unnamed"
        details_list = entry.get("data_source") or []
        if isinstance(details_list, dict):
            details_list = [details_list]
        best_quality = None
        connected = False
        products = []
        applicable_to = []
        for details in details_list:
            if not isinstance(details, dict):
                continue
            applicable_to.extend(details.get("applicable_to") or [])
            products.extend(details.get("products") or [])
            if details.get("available_for_data_analytics"):
                connected = True
            quality = details.get("data_quality")
            if isinstance(quality, dict):
                scores = [
                    quality.get(key)
                    for key in (
                        "device_completeness",
                        "data_field_completeness",
                        "timeliness",
                        "consistency",
                        "retention",
                    )
                ]
                numeric_scores = [s for s in scores if isinstance(s, (int, float))]
                if numeric_scores and (best_quality is None or sum(numeric_scores) > sum(best_quality)):
                    best_quality = numeric_scores
        data_sources.append(
            {
                "name": name,
                "connected": connected,
                "products": sorted(set(products)),
                "applicable_to": sorted(set(applicable_to)),
                "quality_scores": best_quality or [],
                "average_quality": round(sum(best_quality) / len(best_quality), 1) if best_quality else None,
            }
        )
    return {
        "file_type": data.get("file_type", "data-source-administration"),
        "name": data.get("name", ""),
        "date": parse_timestamp(data.get("date")),
        "data_sources": data_sources,
        "techniques": [],
        "groups": [],
    }


def parse_techniques_administration(data):
    """Normalize a ``techniques-administration`` file payload."""
    techniques = []
    for entry in data.get("techniques") or []:
        if not isinstance(entry, dict):
            continue
        technique_id = entry.get("technique_id") or "Unknown"
        detections = entry.get("detection") or []
        visibilities = entry.get("visibility") or []
        if isinstance(detections, dict):
            detections = [detections]
        if isinstance(visibilities, dict):
            visibilities = [visibilities]

        detection_scores = []
        for det in detections:
            score = latest_score(det.get("score_logbook"))
            if score is not None:
                detection_scores.append(score)
        visibility_scores = []
        for vis in visibilities:
            score = latest_score(vis.get("score_logbook"))
            if score is not None:
                visibility_scores.append(score)

        techniques.append(
            {
                "technique_id": technique_id,
                "name": entry.get("technique_name", ""),
                "detection_score": max(detection_scores) if detection_scores else None,
                "visibility_score": max(visibility_scores) if visibility_scores else None,
                "detection_count": len(detections),
                "visibility_count": len(visibilities),
            }
        )
    return {
        "file_type": data.get("file_type", "techniques-administration"),
        "name": data.get("name", ""),
        "date": parse_timestamp(data.get("date")),
        "data_sources": [],
        "techniques": techniques,
        "groups": [],
    }


def parse_group_administration(data):
    """Normalize a ``group-administration`` file payload."""
    groups = []
    for entry in data.get("groups") or []:
        if not isinstance(entry, dict):
            continue
        groups.append(
            {
                "group_name": entry.get("group_name") or "Unknown group",
                "campaign": entry.get("campaign", ""),
                "technique_ids": entry.get("technique_id") or [],
                "software_ids": entry.get("software_id") or [],
                "enabled": entry.get("enabled", True),
            }
        )
    return {
        "file_type": data.get("file_type", "group-administration"),
        "name": data.get("name", ""),
        "date": parse_timestamp(data.get("date")),
        "data_sources": [],
        "techniques": [],
        "groups": groups,
    }


_FILE_TYPE_PARSERS = {
    "data-source-administration": parse_data_source_administration,
    "techniques-administration": parse_techniques_administration,
    "group-administration": parse_group_administration,
}


def parse_dettct_file(path):
    """Parse a DeTT&CT YAML (or JSON) administration file into a normalized payload.

    Args:
        path: Filesystem path to the DeTT&CT output file.

    Returns:
        A dict payload with ``file_type``, ``name``, ``date``, ``data_sources``,
        ``techniques``, and ``groups`` keys.

    Raises:
        ValueError: If the file cannot be read or its type cannot be determined.
    """
    try:
        with open(path, "r", encoding="utf-8") as handle:
            raw = handle.read()
    except OSError as exc:
        raise ValueError(f"Unable to read DeTT&CT file {path}: {exc}") from exc

    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        # Some DeTT&CT outputs are JSON; fall back to that before giving up
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            raise ValueError(f"Unable to parse DeTT&CT file {path}: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError(f"DeTT&CT file {path} does not contain a YAML mapping.")

    file_type = data.get("file_type")
    parser = _FILE_TYPE_PARSERS.get(file_type)
    if parser is None:
        # Try to infer the type from the keys present
        if "data_sources" in data:
            parser = parse_data_source_administration
        elif "techniques" in data:
            parser = parse_techniques_administration
        elif "groups" in data:
            parser = parse_group_administration
        else:
            raise ValueError(f"DeTT&CT file {path} has unknown file_type {file_type!r}.")

    logger.info("Parsing DeTT&CT file %s as %s", path, file_type)
    return parser(data)
