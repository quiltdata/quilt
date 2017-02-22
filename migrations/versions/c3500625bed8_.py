"""empty message

Revision ID: c3500625bed8
Revises: 3dcc171e7253
Create Date: 2017-02-21 16:08:43.397517

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'c3500625bed8'
down_revision = '3dcc171e7253'
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table('blob', 'instance')

    op.alter_column('log', 'blob_id', new_column_name='instance_id', existing_type=sa.BigInteger())
    op.alter_column('version', 'blob_id', new_column_name='instance_id', existing_type=sa.BigInteger())
    op.alter_column('tag', 'blob_id', new_column_name='instance_id', existing_type=sa.BigInteger())

def downgrade():
    op.rename_table('instance', 'blob')

    op.alter_column('log', 'instance_id', new_column_name='blob_id', existing_type=sa.BigInteger())
    op.alter_column('version', 'instance_id', new_column_name='blob_id', existing_type=sa.BigInteger())
    op.alter_column('tag', 'instance_id', new_column_name='blob_id', existing_type=sa.BigInteger())
