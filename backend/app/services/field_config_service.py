"""Field configuration service: apply user-defined field transformations to raw crawled data."""

import re
from datetime import datetime
from typing import Any


TRANSFORMS = {
    "to_int": lambda v: int(float(v)) if v else 0,
    "to_float": lambda v: float(v) if v else 0.0,
    "to_date": lambda v: str(v),
    "strip_html": lambda v: re.sub(r"<[^>]+>", "", str(v)) if v else "",
    "trim": lambda v: str(v).strip() if v else "",
    "lowercase": lambda v: str(v).lower() if v else "",
    "uppercase": lambda v: str(v).upper() if v else "",
}


def apply_field_config(raw_data: dict, config: dict) -> dict:
    """
    Apply field config to raw crawled data.

    config format:
    {
        "field_mappings": {
            "original_name": {"renamed": "new_name", "visible": true, "transform": "to_int"}
        },
        "visible_fields": ["field1", "field2"],  # if empty, show all
        "field_order": ["field2", "field1"],       # display order
    }
    """
    mappings = config.get("field_mappings", {})
    visible = set(config.get("visible_fields", []))
    order = config.get("field_order", [])

    result = {}
    for key, value in raw_data.items():
        mapping = mappings.get(key, {})
        if isinstance(mapping, dict):
            is_visible = mapping.get("visible", True)
            new_name = mapping.get("renamed", key)
            transform = mapping.get("transform")
        else:
            is_visible = True
            new_name = key
            transform = None

        if visible and key not in visible:
            continue
        if not is_visible:
            continue

        if transform and transform in TRANSFORMS:
            try:
                value = TRANSFORMS[transform](value)
            except (ValueError, TypeError):
                pass

        result[new_name] = value

    if order:
        ordered = {}
        for field in order:
            if field in result:
                ordered[field] = result[field]
        for field in result:
            if field not in ordered:
                ordered[field] = result[field]
        return ordered

    return result
