"""Add a primary key constraint to instance_blob

Revision ID: 51f5495f8923
Revises: c0867d76ace6
Create Date: 2018-02-06 14:35:16.142420

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '51f5495f8923'
down_revision = 'c0867d76ace6'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('instance_blob', 'blob_id', existing_type=sa.BIGINT(), nullable=False)
    op.alter_column('instance_blob', 'instance_id', existing_type=sa.BIGINT(), nullable=False)
    op.create_primary_key('pk_instance_blob', 'instance_blob', ['instance_id', 'blob_id'])

def downgrade():
    op.drop_constraint('pk_instance_blob', 'instance_blob', type_='primary')
    op.alter_column('instance_blob', 'blob_id', existing_type=sa.BIGINT(), nullable=True)
    op.alter_column('instance_blob', 'instance_id', existing_type=sa.BIGINT(), nullable=True)
