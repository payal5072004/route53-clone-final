from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..bind_utils import parse_bind_zone_file, generate_bind_zone_file, BindParseError

router = APIRouter(prefix="/api/hosted-zones/{zone_id}/records", tags=["dns-records"])


def _get_zone_or_404(db: Session, zone_id: str) -> models.HostedZone:
    zone = db.query(models.HostedZone).filter(models.HostedZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Hosted zone not found")
    return zone


def _sync_record_count(db: Session, zone: models.HostedZone):
    zone.record_count = (
        db.query(models.DNSRecord).filter(models.DNSRecord.hosted_zone_id == zone.id).count()
    )
    db.commit()


@router.get("", response_model=schemas.PaginatedDNSRecords)
def list_records(
    zone_id: str,
    search: str | None = Query(default=None, description="Search by record name or value"),
    record_type: str | None = Query(default=None, description="Filter by record type"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    _get_zone_or_404(db, zone_id)

    query = db.query(models.DNSRecord).filter(models.DNSRecord.hosted_zone_id == zone_id)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (models.DNSRecord.name.ilike(like)) | (models.DNSRecord.value.ilike(like))
        )
    if record_type:
        query = query.filter(models.DNSRecord.record_type == record_type)

    total = query.count()
    items = (
        query.order_by(models.DNSRecord.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return schemas.PaginatedDNSRecords(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=schemas.DNSRecordOut, status_code=201)
def create_record(
    zone_id: str,
    payload: schemas.DNSRecordCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    zone = _get_zone_or_404(db, zone_id)

    record = models.DNSRecord(
        hosted_zone_id=zone.id,
        name=payload.name,
        record_type=payload.record_type,
        value=payload.value,
        ttl=payload.ttl,
        routing_policy=payload.routing_policy,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    _sync_record_count(db, zone)
    return record


@router.post("/import", response_model=schemas.ImportSummary)
async def import_bind_zone_file(
    zone_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    zone = _get_zone_or_404(db, zone_id)

    if file.filename and not file.filename.lower().endswith((".zone", ".txt", ".bind", ".db")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a .zone or .txt BIND zone file.",
        )

    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="The file must be plain text (UTF-8).")

    try:
        parsed_records = parse_bind_zone_file(text, default_origin=zone.domain_name)
    except BindParseError as e:
        raise HTTPException(status_code=422, detail=str(e))

    created = 0
    skipped = 0
    errors: list[str] = []

    for pr in parsed_records:
        try:
            record = models.DNSRecord(
                hosted_zone_id=zone.id,
                name=pr.name,
                record_type=pr.record_type,
                value=pr.value,
                ttl=pr.ttl,
            )
            db.add(record)
            db.commit()
            created += 1
        except Exception as e:  # pragma: no cover - defensive
            db.rollback()
            skipped += 1
            errors.append(f"{pr.name} ({pr.record_type}): {str(e)}")

    _sync_record_count(db, zone)

    return schemas.ImportSummary(created=created, skipped=skipped, errors=errors)


@router.get("/export")
def export_records(
    zone_id: str,
    format: str = Query(default="json", pattern="^(json|bind)$"),
    ids: str | None = Query(default=None, description="Comma-separated record ids to export (defaults to all)"),
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    zone = _get_zone_or_404(db, zone_id)

    query = db.query(models.DNSRecord).filter(models.DNSRecord.hosted_zone_id == zone_id)
    if ids:
        id_list = [i for i in ids.split(",") if i]
        query = query.filter(models.DNSRecord.id.in_(id_list))
    records = query.order_by(models.DNSRecord.name.asc()).all()

    if format == "bind":
        content = generate_bind_zone_file(zone.domain_name, records)
        filename = f"{zone.domain_name}-records.zone"
        return PlainTextResponse(
            content,
            media_type="text/dns",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    payload = {
        "hosted_zone": zone.domain_name,
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "records": [
            {
                "name": r.name,
                "record_type": r.record_type,
                "value": r.value,
                "ttl": r.ttl,
                "routing_policy": r.routing_policy,
            }
            for r in records
        ],
    }
    filename = f"{zone.domain_name}-records.json"
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/bulk-delete", response_model=schemas.BulkActionResult)
def bulk_delete_records(
    zone_id: str,
    payload: schemas.BulkIdsRequest,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    zone = _get_zone_or_404(db, zone_id)
    records = (
        db.query(models.DNSRecord)
        .filter(models.DNSRecord.hosted_zone_id == zone_id, models.DNSRecord.id.in_(payload.ids))
        .all()
    )
    count = len(records)
    for r in records:
        db.delete(r)
    db.commit()
    _sync_record_count(db, zone)
    return schemas.BulkActionResult(deleted=count)


@router.post("/bulk-update-ttl", response_model=schemas.BulkActionResult)
def bulk_update_ttl(
    zone_id: str,
    payload: schemas.BulkTTLUpdateRequest,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    _get_zone_or_404(db, zone_id)
    records = (
        db.query(models.DNSRecord)
        .filter(models.DNSRecord.hosted_zone_id == zone_id, models.DNSRecord.id.in_(payload.ids))
        .all()
    )
    for r in records:
        r.ttl = payload.ttl
    db.commit()
    return schemas.BulkActionResult(updated=len(records))


@router.get("/{record_id}", response_model=schemas.DNSRecordOut)
def get_record(
    zone_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    _get_zone_or_404(db, zone_id)
    record = (
        db.query(models.DNSRecord)
        .filter(models.DNSRecord.id == record_id, models.DNSRecord.hosted_zone_id == zone_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@router.put("/{record_id}", response_model=schemas.DNSRecordOut)
def update_record(
    zone_id: str,
    record_id: str,
    payload: schemas.DNSRecordUpdate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    _get_zone_or_404(db, zone_id)
    record = (
        db.query(models.DNSRecord)
        .filter(models.DNSRecord.id == record_id, models.DNSRecord.hosted_zone_id == zone_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=204)
def delete_record(
    zone_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    zone = _get_zone_or_404(db, zone_id)
    record = (
        db.query(models.DNSRecord)
        .filter(models.DNSRecord.id == record_id, models.DNSRecord.hosted_zone_id == zone_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    db.delete(record)
    db.commit()
    _sync_record_count(db, zone)
    return None
