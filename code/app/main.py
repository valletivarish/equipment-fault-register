"""HTTP API for the equipment fault register.

Every route sits under /api so Nginx can serve the React build at / and pass
only /api/ requests to this process on 127.0.0.1:8000. The browser therefore
talks to a single origin and no CORS configuration is needed.
"""

import os

from fastapi import Depends, FastAPI, HTTPException, Response
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import EquipmentFault
from app.schemas import FaultIn, FaultOut

# Interactive docs are switched off in production to reduce the public surface.
app = FastAPI(title="Equipment Fault Register", docs_url=None, redoc_url=None)

# The deploy script sets RELEASE_ID to the git commit SHA, so the health check
# shows exactly which tested commit is running on EC2.
RELEASE_ID = os.environ.get("RELEASE_ID", "local")


def find_fault(fault_id: int, session: Session) -> EquipmentFault:
    fault = session.get(EquipmentFault, fault_id)
    if fault is None:
        raise HTTPException(status_code=404, detail="Fault not found")
    return fault


@app.get("/api/health")
def health(session: Session = Depends(get_session)):
    """Used by the CD smoke test, the rollback script and monitoring.

    It runs a trivial query so a broken RDS connection shows as unhealthy
    instead of the API looking fine while every real request fails.
    """
    try:
        session.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable") from None
    return {"status": "ok", "release": RELEASE_ID}


@app.get("/api/faults", response_model=list[FaultOut])
def list_faults(session: Session = Depends(get_session)):
    # Newest reports first, which is how the coordinator reads the register.
    query = select(EquipmentFault).order_by(
        EquipmentFault.reported_date.desc(), EquipmentFault.id.desc()
    )
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
