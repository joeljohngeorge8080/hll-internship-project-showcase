import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlmodel import Session

from app.models.audit import ActionType, AuditLog
from app.models.user import User

logger = logging.getLogger('hma.audit')

# Writes to the Supabase-native `audit_logs` table (see
# supabase/migrations/00000000000017_audit_log.sql, extended by 00000000000060,
# 00000000000077, and 00000000000084). That table is also written to
# automatically by a Postgres trigger for projects/employees/salary_details/
# core_salaries edits made directly via supabase-js, so its column shape is
# owned by the migrations, not by this backend — see app/models/audit.py.


def write_audit(
    session: Session,
    actor: User,
    module_name: str,
    action_type: ActionType,
    record_id: Optional[str] = None,
    old_value: Optional[Any] = None,
    new_value: Optional[Any] = None,
    remarks: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    logger.info(
        'AUDIT module=%s action=%s actor=%s(%s) record=%s ip=%s remarks=%s',
        module_name, action_type.value, actor.google_email, actor.role.value,
        record_id, ip_address, remarks,
    )
    # record_id from callers is a free-form string (not always a real uuid,
    # e.g. batch/report identifiers) — best-effort cast, same as the
    # log_manual_audit_entry() RPC does for supabase-js callers.
    try:
        parsed_record_id = uuid.UUID(record_id) if record_id else None
    except ValueError:
        parsed_record_id = None

    session.add(AuditLog(
        actor_profile_id=actor.id,
        actor_name=actor.google_email,
        actor_role=actor.role.value,
        table_name=module_name,
        record_id=parsed_record_id,
        action='MANUAL',
        old_data=old_value,
        new_data=new_value,
        entry_kind='manual',
        action_label=action_type.value,
        record_label=record_id,
        details=remarks,
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc),
    ))
    # Caller is responsible for session.commit()
