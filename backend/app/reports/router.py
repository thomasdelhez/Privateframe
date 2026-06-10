from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, HTTPException, Request, status
from sqlmodel import desc, select

from app.auth.dependencies import AdminUserDep, AgeConfirmedUserDep, SessionDep
from app.core.enums import ReportReason, ReportStatus, ReportTargetType
from app.core.rate_limit import enforce_user_rate_limit
from app.reports.models import Report

router = APIRouter(prefix="/reports", tags=["Reports"])


def _serialize(item: Report) -> dict:
    return {
        "id": item.id,
        "reporter_user_id": item.reporter_user_id,
        "target_type": item.target_type,
        "target_id": item.target_id,
        "reason": item.reason,
        "description": item.description,
        "status": item.status,
        "created_at": item.created_at,
        "resolved_at": item.resolved_at,
    }


@router.post("")
def create_report(
    request: Request,
    user: AgeConfirmedUserDep,
    session: SessionDep,
    target_type: Annotated[ReportTargetType, Body(embed=True)],
    target_id: Annotated[UUID, Body(embed=True)],
    reason: Annotated[ReportReason, Body(embed=True)],
    description: Annotated[str | None, Body(embed=True)] = None,
) -> dict:
    enforce_user_rate_limit(request, "report", str(user.id), attempts=20, window_seconds=3600)
    existing = session.exec(
        select(Report).where(
            Report.reporter_user_id == user.id,
            Report.target_type == target_type,
            Report.target_id == target_id,
            Report.status == ReportStatus.OPEN,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Je hebt dit al gemeld; de melding wordt nog beoordeeld",
        )
    item = Report(
        reporter_user_id=user.id,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        description=description,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return _serialize(item)


@router.get("/my")
def list_my_reports(user: AgeConfirmedUserDep, session: SessionDep) -> list[dict]:
    items = session.exec(
        select(Report).where(Report.reporter_user_id == user.id).order_by(desc(Report.created_at)).limit(50)
    ).all()
    return [_serialize(item) for item in items]


@router.get("/admin")
def list_all_reports(_: AdminUserDep, session: SessionDep) -> list[dict]:
    items = session.exec(select(Report).order_by(desc(Report.created_at)).limit(100)).all()
    return [_serialize(item) for item in items]


@router.post("/admin/{report_id}/resolve")
def resolve_report(report_id: UUID, admin: AdminUserDep, session: SessionDep) -> dict:
    item = session.get(Report, report_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Melding niet gevonden")
    item.status = ReportStatus.RESOLVED
    item.resolved_at = datetime.now(UTC)
    item.resolved_by = admin.id
    session.add(item)
    session.commit()
    session.refresh(item)
    return _serialize(item)
