"""Alembic runs migrations against the same DATABASE_URL the API uses.

On EC2 the deploy script runs `alembic upgrade head` before switching the
release, so schema changes reach RDS through the pipeline, not by hand.
"""

from alembic import context

from app import models  # noqa: F401  (registers the table on Base.metadata)
from app.db import Base, engine

with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
