"""Routes live under /api so Nginx can serve React at / and proxy only /api/
to this process on 127.0.0.1:8000: one origin, no CORS needed."""

import os
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import EquipmentFault, RepairNote
from app.schemas import FaultIn, FaultOut, NoteIn, NoteOut, RepairStatus

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


@app.get("/api/faults", response_model=list[FaultOut])
def list_faults(
    q: str | None = Query(None, max_length=40),
    status: RepairStatus | None = None,
    session: Session = Depends(get_session),
):
    query = select(EquipmentFault).order_by(
        EquipmentFault.reported_date.desc(), EquipmentFault.id.desc()
    )
    if q and q.strip():
        # autoescape makes % and _ in the search text match literally.
        text_match = EquipmentFault.asset_tag.icontains(q.strip(), autoescape=True)
        name_match = EquipmentFault.equipment_name.icontains(q.strip(), autoescape=True)
        query = query.where(text_match | name_match)
    if status:
        query = query.where(EquipmentFault.repair_status == status)
    return session.scalars(query).all()


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
