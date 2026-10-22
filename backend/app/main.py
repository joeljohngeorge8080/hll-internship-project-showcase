from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from app.core.config import settings
from app.database import create_tables, engine
from app.models import project  # noqa: F401 — registers Project table before create_all()
from app.models.user import User, UserRole
from app.routers import auth, aws_billing, employees, general_expenses, users


def _seed_admin(session: Session):
    admin_email = 'admin@example.com'
    exists = session.exec(select(User).where(User.google_email == admin_email)).first()
    if not exists:
        now = datetime.now(timezone.utc)
        session.add(User(
            google_email=admin_email,
            full_name='HMA Admin',
            role=UserRole.ADMIN,
            is_active=True,
            created_at=now,
            updated_at=now,
        ))
        session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    with Session(engine) as session:
        _seed_admin(session)
    yield


app = FastAPI(
    title='HMA IEMS API',
    version='1.0.0',
    lifespan=lifespan,
    docs_url='/docs' if settings.ENVIRONMENT == 'development' else None,
    redoc_url='/redoc' if settings.ENVIRONMENT == 'development' else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(',')],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(general_expenses.router)
app.include_router(users.router)
app.include_router(aws_billing.router)


@app.get('/health')
def health():
    return {'status': 'ok'}
