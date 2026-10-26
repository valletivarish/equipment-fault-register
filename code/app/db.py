"""DATABASE_URL points at local PostgreSQL, the CI container or Amazon RDS.

On EC2 the deploy script builds it from the RDS endpoint and the password held
in SSM Parameter Store, so no credential is stored in the repository.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://faults:faults@localhost:55432/faults",
)

# pre_ping survives RDS dropping idle connections; a small pool suits one
# t3.micro instance and keeps RDS memory use low.
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=2)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
