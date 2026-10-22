from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, echo=settings.ENVIRONMENT == 'development')


def get_session():
    with Session(engine) as session:
        yield session


def create_tables():
    SQLModel.metadata.create_all(engine)
