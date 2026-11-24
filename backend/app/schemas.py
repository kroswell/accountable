from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


DealStage = Literal["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]
ContactStatus = Literal["Lead", "Qualified", "Customer"]
ActivityType = Literal["Note", "Call", "Email"]


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OrganizationCreate(RequestModel):
    name: str = Field(min_length=1, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    industry: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class ContactCreate(RequestModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=80)
    job_title: str | None = Field(default=None, max_length=150)
    organization_id: str | None = None
    status: ContactStatus


class DealCreate(RequestModel):
    name: str = Field(min_length=1, max_length=200)
    organization_id: str = Field(min_length=1)
    main_contact_id: str | None = None
    stage: DealStage
    value_usd: float = Field(ge=0)
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close_date: date | None = None
    actual_close_date: date | None = None


class ActivityCreate(RequestModel):
    type: ActivityType
    description: str = Field(min_length=1)
    happened_at: datetime
    follow_up_date: date | None = None
    done: bool = False
    contact_id: str | None = None
    deal_id: str | None = None

    @model_validator(mode="after")
    def require_related_record(self):
        if not self.contact_id and not self.deal_id:
            raise ValueError("An activity must be linked to a contact or deal")
        return self


class StageMove(RequestModel):
    stage: DealStage
    position: int = Field(ge=0)
