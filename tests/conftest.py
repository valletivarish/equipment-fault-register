# Tests use real PostgreSQL (same engine as RDS), emptied before each test.

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import Base, engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def create_schema():
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def clean_table():
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE equipment_faults, repair_notes RESTART IDENTITY CASCADE"))


@pytest.fixture
def client():
    return TestClient(app)
