"""Table definition for the equipment fault register."""

from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

# The workshop uses a short, fixed set of repair states. Keeping the list here
# lets the API schema, the database check constraint and the React form agree.
REPAIR_STATUSES = ("Reported", "In repair", "Awaiting parts", "Repaired", "Written off")


class EquipmentFault(Base):
    __tablename__ = "equipment_faults"
    # The database enforces the allowed statuses as a second line of defence,
    # so a bad value is rejected even if it bypasses the API validation.
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
    fault_description: Mapped[str] = mapped_column(Text)
    reported_date: Mapped[date] = mapped_column(Date)
    repair_status: Mapped[str] = mapped_column(String(20), default="Reported")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
