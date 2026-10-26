"""Rename repair statuses to plainer words.

Revision ID: 0004
Revises: 0003
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

RENAMES = [
    ("Reported", "Open"),
    ("In repair", "In progress"),
    ("Awaiting parts", "Waiting for parts"),
    ("Repaired", "Fixed"),
    ("Written off", "Not repairable"),
]


def switch(pairs, allowed, default):
    # The old check constraint would reject the new words, so it is dropped,
    # the rows are converted, and a constraint for the new set is added.
    op.drop_constraint("ck_repair_status", "equipment_faults", type_="check")
    for old, new in pairs:
        op.execute(
            f"UPDATE equipment_faults SET repair_status = '{new}' "  # noqa: S608
            f"WHERE repair_status = '{old}'"
        )
    quoted = ", ".join(f"'{value}'" for value in allowed)
    op.create_check_constraint(
        "ck_repair_status", "equipment_faults", f"repair_status IN ({quoted})"
    )
    op.alter_column("equipment_faults", "repair_status", server_default=default)


def upgrade():
    switch(RENAMES, [new for _, new in RENAMES], "Open")


def downgrade():
    switch([(new, old) for old, new in RENAMES], [old for old, _ in RENAMES], "Reported")
