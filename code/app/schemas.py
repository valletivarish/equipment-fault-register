"""Request and response shapes with the register's validation rules."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

RepairStatus = Literal["Reported", "In repair", "Awaiting parts", "Repaired", "Written off"]


class FaultIn(BaseModel):
    """Fields a coordinator types when reporting or editing a fault."""

    # Asset tags are printed on stickers such as "WS-DRILL-04": letters, digits
    # and dashes only, so the pattern rejects spaces and stray symbols.
    asset_tag: str = Field(min_length=2, max_length=20, pattern=r"^[A-Za-z0-9-]+$")
    equipment_name: str = Field(min_length=2, max_length=80)
    fault_description: str = Field(min_length=5, max_length=1000)
    reported_date: date
    repair_status: RepairStatus = "Reported"

    @field_validator("asset_tag", "equipment_name", "fault_description", mode="before")
    @classmethod
    def strip_text(cls, value):
        # Trim before the length checks so "   " counts as empty, not 3 characters.
        return value.strip() if isinstance(value, str) else value

    @field_validator("asset_tag")
    @classmethod
    def upper_tag(cls, value: str) -> str:
        # Stored in capitals so "ws-01" and "WS-01" read as the same sticker.
        return value.upper()

    @field_validator("reported_date")
    @classmethod
    def not_in_future(cls, value: date) -> date:
        # A fault cannot be reported before it happens.
        if value > date.today():
            raise ValueError("Reported date cannot be in the future")
        return value


class FaultOut(FaultIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
