"""Database engine and session handling.

The connection string comes from the DATABASE_URL environment variable so the
same code talks to the local Docker PostgreSQL, the CI service container and
Amazon RDS without any code change. On EC2 the deploy script builds this value
from the RDS endpoint and the password stored in SSM Parameter Store, so the
password never appears in the repository.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://faults:faults@localhost:55432/faults",
)

# pool_pre_ping checks a pooled connection before use, which avoids errors
# after RDS has closed idle connections (for example after a lab restart).
# A small pool is enough for one t3.micro instance and keeps RDS memory low.
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=2)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_session():
    """FastAPI dependency that opens one session per request and always closes it."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
