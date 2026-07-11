"""
BIND zone file parsing and generation.

Supports the common record types required by the assignment: A, AAAA, CNAME,
MX, TXT, NS, PTR, SRV, CAA. This is a pragmatic parser for the standard
master-file format, not a full RFC 1035 implementation (no $INCLUDE,
no multi-line parenthesized SOA parsing beyond skipping it).
"""

import re
from dataclasses import dataclass

SUPPORTED_TYPES = {"A", "AAAA", "CNAME", "MX", "TXT", "NS", "PTR", "SRV", "CAA"}


@dataclass
class ParsedRecord:
    name: str
    record_type: str
    value: str
    ttl: int = 300


class BindParseError(Exception):
    pass


def parse_bind_zone_file(content: str, default_origin: str = "") -> list[ParsedRecord]:
    """
    Parse BIND zone file text into a list of ParsedRecord.

    Expected line shape (whitespace separated), e.g.:
        www.example.com.    300    IN    A       192.0.2.1
        example.com.        300    IN    MX      10 mail.example.com.
        @                    300    IN    TXT     "v=spf1 -all"

    Lines starting with ';' are comments. $ORIGIN / $TTL directives are
    tracked and applied. SOA records are skipped (Route53 hosted zones
    manage SOA implicitly).
    """
    if not content or not content.strip():
        raise BindParseError("The uploaded file is empty.")

    records: list[ParsedRecord] = []
    default_ttl = 300
    origin = default_origin
    last_name = origin or "@"

    # Strip comments (but keep quoted TXT values intact)
    lines = content.splitlines()

    line_no = 0
    for raw_line in lines:
        line_no += 1
        line = raw_line.split(";", 1)[0].rstrip() if not _has_quoted_semicolon(raw_line) else raw_line.rstrip()
        if not line.strip():
            continue

        stripped = line.strip()

        if stripped.upper().startswith("$ORIGIN"):
            parts = stripped.split()
            if len(parts) >= 2:
                origin = parts[1].rstrip(".")
            continue

        if stripped.upper().startswith("$TTL"):
            parts = stripped.split()
            if len(parts) >= 2 and parts[1].isdigit():
                default_ttl = int(parts[1])
            continue

        if stripped.startswith("(") or stripped.startswith(")"):
            # multi-line SOA continuation - not supported, skip
            continue

        tokens = _tokenize(stripped)
        if not tokens:
            continue

        # Determine if the line starts with a name or is a continuation
        # (i.e. the record type field is one of our known RR types)
        idx = 0
        if tokens[0].upper() in SUPPORTED_TYPES or tokens[0].upper() in {"SOA", "IN"}:
            name = last_name
        else:
            name = tokens[0]
            last_name = name
            idx = 1

        # Skip optional TTL / class tokens until we find the record type
        ttl = default_ttl
        record_type = None
        while idx < len(tokens):
            tok = tokens[idx]
            if tok.isdigit():
                ttl = int(tok)
                idx += 1
                continue
            if tok.upper() in {"IN", "CH", "HS"}:
                idx += 1
                continue
            if tok.upper() in SUPPORTED_TYPES or tok.upper() == "SOA":
                record_type = tok.upper()
                idx += 1
                break
            # Unknown token before type found — bail on this line
            idx += 1

        if record_type is None:
            continue  # couldn't identify a record type on this line, skip

        if record_type == "SOA":
            continue  # Route53 manages SOA implicitly

        if record_type not in SUPPORTED_TYPES:
            continue

        value_tokens = tokens[idx:]
        if not value_tokens:
            raise BindParseError(
                f"Line {line_no}: record '{name}' of type {record_type} is missing a value."
            )
        value = " ".join(value_tokens).strip('"') if record_type == "TXT" else " ".join(value_tokens)

        full_name = name if name in ("@",) else name.rstrip(".")
        if full_name == "@":
            full_name = origin or default_origin or "@"

        records.append(ParsedRecord(name=full_name, record_type=record_type, value=value, ttl=ttl))

    if not records:
        raise BindParseError(
            "No valid DNS records were found in this file. "
            "Make sure it's a standard BIND zone file with A, AAAA, CNAME, MX, TXT, NS, PTR, SRV or CAA records."
        )

    return records


def _has_quoted_semicolon(line: str) -> bool:
    """True if a ';' in the line falls inside quotes (so it's not a comment)."""
    in_quotes = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_quotes = not in_quotes
        if ch == ";" and in_quotes:
            return True
    return False


def _tokenize(line: str) -> list[str]:
    """Split a line into tokens, keeping quoted strings as single tokens."""
    tokens = re.findall(r'"[^"]*"|\S+', line)
    return tokens


def generate_bind_zone_file(domain_name: str, records: list) -> str:
    """
    Generate a BIND-formatted zone file string from a list of DNSRecord-like
    objects (must have .name, .record_type, .value, .ttl attributes).
    """
    lines = [
        f"; Zone file for {domain_name}",
        f"; Exported from Route53 Clone",
        f"$ORIGIN {domain_name}.",
        "$TTL 300",
        "",
    ]
    for r in records:
        name = r.name if r.name else "@"
        value = r.value.replace("\n", " ")
        if r.record_type == "TXT" and not value.startswith('"'):
            value = f'"{value}"'
        lines.append(f"{name:<32} {r.ttl:<8} IN  {r.record_type:<6} {value}")
    return "\n".join(lines) + "\n"
