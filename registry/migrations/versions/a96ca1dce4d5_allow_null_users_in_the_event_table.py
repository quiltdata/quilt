"""Allow null users in the event table

Revision ID: a96ca1dce4d5
Revises: 51f5495f8923
Create Date: 2018-02-14 13:15:17.281694

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a96ca1dce4d5'
down_revision = '51f5495f8923'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('event', 'user',
               existing_type=sa.VARCHAR(length=64),
               nullable=True)


def downgrade():
    op.alter_column('event', 'user',
               existing_type=sa.VARCHAR(length=64),
               nullable=False)
