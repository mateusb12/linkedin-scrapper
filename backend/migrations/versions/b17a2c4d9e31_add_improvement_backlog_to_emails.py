"""add improvement backlog to emails

Revision ID: b17a2c4d9e31
Revises: f9cd4ef9e4ca
Create Date: 2026-04-30 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b17a2c4d9e31'
down_revision = 'f9cd4ef9e4ca'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('emails', sa.Column('improvement_backlog', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('emails', 'improvement_backlog')
