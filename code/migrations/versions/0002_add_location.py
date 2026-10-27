# Add the workshop location of each fault.

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    # Existing rows get a placeholder so the column can be NOT NULL straight away.
    op.add_column(
        "equipment_faults",
        sa.Column("location", sa.String(40), nullable=False, server_default="Main workshop"),
    )
    op.alter_column("equipment_faults", "location", server_default=None)


def downgrade():
    op.drop_column("equipment_faults", "location")
