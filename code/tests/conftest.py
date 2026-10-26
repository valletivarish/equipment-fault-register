"""Shared test setup.

The tests run against a real PostgreSQL database (the Docker container locally,
a service container in GitHub Actions) so they exercise the same SQL behaviour
as Amazon RDS. The table is emptied before every test so tests do not depend
on each other.
"""

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
        conn.execute(text("TRUNCATE equipment_faults RESTART IDENTITY"))


@pytest.fixture
def client():
    return TestClient(app)
