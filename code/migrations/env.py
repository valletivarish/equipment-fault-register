"""Uses the API's DATABASE_URL; the deploy script runs `alembic upgrade head`
on EC2 before switching releases, so schema changes reach RDS via the pipeline."""

from alembic import context

from app import models  # noqa: F401  (registers the table on Base.metadata)
from app.db import Base, engine

with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
