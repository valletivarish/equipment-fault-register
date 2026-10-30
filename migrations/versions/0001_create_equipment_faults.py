# Create the equipment_faults table.

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "equipment_faults",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("asset_tag", sa.String(20), nullable=False, index=True),
        sa.Column("equipment_name", sa.String(80), nullable=False),
        sa.Column("fault_description", sa.Text, nullable=False),
        sa.Column("reported_date", sa.Date, nullable=False),
        sa.Column("repair_status", sa.String(20), nullable=False, server_default="Reported"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "repair_status IN ('Reported', 'In repair', 'Awaiting parts', "
            "'Repaired', 'Written off')",
            name="ck_repair_status",
        ),
    )


def downgrade():
    op.drop_table("equipment_faults")
