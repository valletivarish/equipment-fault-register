"""Create the repair_notes table.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "repair_notes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "fault_id",
            sa.Integer,
            sa.ForeignKey("equipment_faults.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("note_date", sa.Date, nullable=False),
        sa.Column("note", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("repair_notes")
