from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

RepairStatus = Literal["Reported", "In repair", "Awaiting parts", "Repaired", "Written off"]


class FaultIn(BaseModel):
    # Matches the printed sticker format, e.g. "WS-DRILL-04".
    asset_tag: str = Field(min_length=2, max_length=20, pattern=r"^[A-Za-z0-9-]+$")
    equipment_name: str = Field(min_length=2, max_length=80)
    fault_description: str = Field(min_length=5, max_length=1000)
    reported_date: date
    repair_status: RepairStatus = "Reported"

    @field_validator("asset_tag", "equipment_name", "fault_description", mode="before")
    @classmethod
    def strip_text(cls, value):
        # Trim first so whitespace-only text fails the min_length check.
        return value.strip() if isinstance(value, str) else value

    @field_validator("asset_tag")
    @classmethod
    def upper_tag(cls, value: str) -> str:
        return value.upper()

    @field_validator("reported_date")
    @classmethod
    def not_in_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Reported date cannot be in the future")
        return value


class FaultOut(FaultIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
