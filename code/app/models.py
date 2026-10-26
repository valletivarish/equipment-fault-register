from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class EquipmentFault(Base):
    __tablename__ = "equipment_faults"
    # Second line of defence: rejects a bad status even if it bypasses the API.
    __table_args__ = (
        CheckConstraint(
            "repair_status IN ('Reported', 'In repair', 'Awaiting parts', "
            "'Repaired', 'Written off')",
            name="ck_repair_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_tag: Mapped[str] = mapped_column(String(20), index=True)
    equipment_name: Mapped[str] = mapped_column(String(80))
    location: Mapped[str] = mapped_column(String(40))
    fault_description: Mapped[str] = mapped_column(Text)
    reported_date: Mapped[date] = mapped_column(Date)
    repair_status: Mapped[str] = mapped_column(String(20), default="Reported")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RepairNote(Base):
    __tablename__ = "repair_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Notes belong to one fault and are removed by the database with it.
    fault_id: Mapped[int] = mapped_column(
        ForeignKey("equipment_faults.id", ondelete="CASCADE"), index=True
    )
    note_date: Mapped[date] = mapped_column(Date)
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
