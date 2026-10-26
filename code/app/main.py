"""Routes live under /api so Nginx can serve React at / and proxy only /api/
to this process on 127.0.0.1:8000: one origin, no CORS needed."""

import os
from datetime import date
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import EquipmentFault, RepairNote
from app.schemas import FaultIn, FaultOut, FaultPage, NoteIn, NoteOut, RepairStatus

# Interactive docs are off to keep the public surface small.
app = FastAPI(title="Equipment Fault Register", docs_url=None, redoc_url=None)

# Set to the git commit SHA by the deploy script.
RELEASE_ID = os.environ.get("RELEASE_ID", "local")


def find_fault(fault_id: int, session: Session) -> EquipmentFault:
    fault = session.get(EquipmentFault, fault_id)
    if fault is None:
        raise HTTPException(status_code=404, detail="Fault not found")
    return fault


@app.get("/api/health")
def health(session: Session = Depends(get_session)):
    """Queries the database so a broken RDS connection reports unhealthy.

    Used by the CD smoke test, the rollback script and monitoring.
    """
    try:
        session.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable") from None
    return {"status": "ok", "release": RELEASE_ID}


# Only these columns can be sorted on; the client sends a key, never SQL.
SORT_COLUMNS = {
    "reported_date": EquipmentFault.reported_date,
    "asset_tag": EquipmentFault.asset_tag,
    "equipment_name": EquipmentFault.equipment_name,
    "location": EquipmentFault.location,
    "repair_status": EquipmentFault.repair_status,
}
CLOSED_STATUSES = ("Fixed", "Not repairable")


@app.get("/api/faults", response_model=FaultPage)
def list_faults(
    q: str | None = Query(None, max_length=40),
    status: RepairStatus | None = None,
    sort: Literal[tuple(SORT_COLUMNS)] = "reported_date",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    session: Session = Depends(get_session),
):
    filters = []
    if q and q.strip():
        # autoescape makes % and _ in the search text match literally.
        text_match = EquipmentFault.asset_tag.icontains(q.strip(), autoescape=True)
        name_match = EquipmentFault.equipment_name.icontains(q.strip(), autoescape=True)
        filters.append(text_match | name_match)
    if status:
        filters.append(EquipmentFault.repair_status == status)

    column = SORT_COLUMNS[sort]
    # id as a tie-breaker keeps rows from moving between pages when values repeat.
    ordering = (
        [column.asc(), EquipmentFault.id.asc()]
        if order == "asc"
        else [column.desc(), EquipmentFault.id.desc()]
    )
    items = session.scalars(
        select(EquipmentFault)
        .where(*filters)
        .order_by(*ordering)
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()

    total = session.scalar(select(func.count()).select_from(EquipmentFault).where(*filters))
    open_count = session.scalar(
        select(func.count())
        .select_from(EquipmentFault)
        .where(*filters, EquipmentFault.repair_status.not_in(CLOSED_STATUSES))
    )
    return {
        "items": items,
        "total": total,
        "open_count": open_count,
        "page": page,
        "page_size": page_size,
    }


@app.get("/api/faults/{fault_id}", response_model=FaultOut)
def get_fault(fault_id: int, session: Session = Depends(get_session)):
    return find_fault(fault_id, session)


@app.post("/api/faults", response_model=FaultOut, status_code=201)
def create_fault(data: FaultIn, session: Session = Depends(get_session)):
    fault = EquipmentFault(**data.model_dump())
    session.add(fault)
    session.commit()
    session.refresh(fault)
    return fault


@app.put("/api/faults/{fault_id}", response_model=FaultOut)
def update_fault(fault_id: int, data: FaultIn, session: Session = Depends(get_session)):
    fault = find_fault(fault_id, session)
    for field, value in data.model_dump().items():
        setattr(fault, field, value)
    session.commit()
    session.refresh(fault)
    return fault


@app.delete("/api/faults/{fault_id}", status_code=204)
def delete_fault(fault_id: int, session: Session = Depends(get_session)):
    fault = find_fault(fault_id, session)
    session.delete(fault)
    session.commit()
    return Response(status_code=204)


def check_note_date(note_date: date, fault: EquipmentFault):
    """Repair work cannot be logged before the fault was reported or in the future."""
    if note_date > date.today() or note_date < fault.reported_date:
        # Same shape as FastAPI's own validation errors, so the form shows it per field.
        message = f"Use a date between {fault.reported_date.isoformat()} and today"
        raise HTTPException(
            status_code=422, detail=[{"loc": ["body", "note_date"], "msg": message}]
        )


def find_note(note_id: int, session: Session) -> RepairNote:
    note = session.get(RepairNote, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@app.get("/api/faults/{fault_id}/notes", response_model=list[NoteOut])
def list_notes(fault_id: int, session: Session = Depends(get_session)):
    find_fault(fault_id, session)
    query = (
        select(RepairNote)
        .where(RepairNote.fault_id == fault_id)
        .order_by(RepairNote.note_date.desc(), RepairNote.id.desc())
    )
    return session.scalars(query).all()


@app.post("/api/faults/{fault_id}/notes", response_model=NoteOut, status_code=201)
def create_note(fault_id: int, data: NoteIn, session: Session = Depends(get_session)):
    fault = find_fault(fault_id, session)
    check_note_date(data.note_date, fault)
    note = RepairNote(fault_id=fault_id, **data.model_dump())
    session.add(note)
    session.commit()
    session.refresh(note)
    return note


@app.put("/api/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: int, data: NoteIn, session: Session = Depends(get_session)):
    note = find_note(note_id, session)
    check_note_date(data.note_date, find_fault(note.fault_id, session))
    note.note_date = data.note_date
    note.note = data.note
    session.commit()
    session.refresh(note)
    return note


@app.delete("/api/notes/{note_id}", status_code=204)
def delete_note(note_id: int, session: Session = Depends(get_session)):
    session.delete(find_note(note_id, session))
    session.commit()
    return Response(status_code=204)
