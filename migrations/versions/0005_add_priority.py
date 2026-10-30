# Add a priority to each fault.

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    # Faults recorded before this change are treated as Medium priority.
    op.add_column(
        "equipment_faults",
        sa.Column("priority", sa.String(10), nullable=False, server_default="Medium"),
    )
    op.create_check_constraint(
        "ck_priority", "equipment_faults", "priority IN ('Low', 'Medium', 'High')"
    )


def downgrade():
    op.drop_constraint("ck_priority", "equipment_faults", type_="check")
    op.drop_column("equipment_faults", "priority")
