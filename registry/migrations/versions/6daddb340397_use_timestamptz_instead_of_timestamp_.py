"""Use TIMESTAMPTZ instead of TIMESTAMP type

Revision ID: 6daddb340397
Revises: a96ca1dce4d5
Create Date: 2018-02-15 15:15:44.942813

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '6daddb340397'
down_revision = 'a96ca1dce4d5'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('event', 'created',
               existing_type=postgresql.TIMESTAMP(),
               type_=postgresql.TIMESTAMP(timezone=True),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('instance', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=postgresql.TIMESTAMP(timezone=True),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('instance', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=postgresql.TIMESTAMP(timezone=True),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('invitation', 'invited_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=postgresql.TIMESTAMP(timezone=True),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('log', 'created',
               existing_type=postgresql.TIMESTAMP(),
               type_=postgresql.TIMESTAMP(timezone=True),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))


def downgrade():
    op.alter_column('log', 'created',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('invitation', 'invited_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('instance', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('instance', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('event', 'created',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
