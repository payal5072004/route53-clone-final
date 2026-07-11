"""Pydantic schemas — define the shape of API request/response bodies."""

import re
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_validator

RecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"]

# A valid DNS domain name: dot-separated labels, each label made of letters,
# digits and hyphens, not starting/ending with a hyphen. An optional trailing
# dot (FQDN style, e.g. "example.com.") is allowed and stripped before saving.
DOMAIN_NAME_PATTERN = re.compile(
    r"^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+\.?$"
)


def validate_domain_name(value: str) -> str:
    value = value.strip().lower()
    # strip a single trailing dot (FQDN notation), keep the rest as-is
    normalized = value[:-1] if value.endswith(".") else value
    if len(normalized) > 253 or not DOMAIN_NAME_PATTERN.match(value):
        raise ValueError(
            "Enter a valid domain name, e.g. example.com "
            "(letters, digits and hyphens only, labels separated by dots)."
        )
    return normalized


# ---------- Auth ----------

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str


class UserOut(BaseModel):
    username: str

    class Config:
        from_attributes = True


# ---------- Hosted Zones ----------

class HostedZoneCreate(BaseModel):
    domain_name: str = Field(..., min_length=1, max_length=253, examples=["example.com"])
    comment: Optional[str] = None
    zone_type: Literal["Public", "Private"] = "Public"

    @field_validator("domain_name")
    @classmethod
    def check_domain_name(cls, value: str) -> str:
        return validate_domain_name(value)


class HostedZoneUpdate(BaseModel):
    comment: Optional[str] = None
    zone_type: Optional[Literal["Public", "Private"]] = None


class HostedZoneOut(BaseModel):
    id: str
    domain_name: str
    comment: Optional[str] = None
    zone_type: str
    record_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedHostedZones(BaseModel):
    items: List[HostedZoneOut]
    total: int
    page: int
    page_size: int


# ---------- DNS Records ----------

class DNSRecordCreate(BaseModel):
    name: str = Field(..., min_length=1, examples=["www"])
    record_type: RecordType
    value: str
    ttl: int = 300
    routing_policy: str = "Simple"


class DNSRecordUpdate(BaseModel):
    name: Optional[str] = None
    record_type: Optional[RecordType] = None
    value: Optional[str] = None
    ttl: Optional[int] = None
    routing_policy: Optional[str] = None


class DNSRecordOut(BaseModel):
    id: str
    hosted_zone_id: str
    name: str
    record_type: str
    value: str
    ttl: int
    routing_policy: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedDNSRecords(BaseModel):
    items: List[DNSRecordOut]
    total: int
    page: int
    page_size: int


# ---------- Bulk operations ----------

class BulkIdsRequest(BaseModel):
    ids: List[str] = Field(..., min_length=1)


class BulkTTLUpdateRequest(BaseModel):
    ids: List[str] = Field(..., min_length=1)
    ttl: int = Field(..., ge=0)


class BulkActionResult(BaseModel):
    deleted: int = 0
    updated: int = 0


# ---------- Import / Export ----------

class ImportSummary(BaseModel):
    created: int
    skipped: int
    errors: List[str] = []
