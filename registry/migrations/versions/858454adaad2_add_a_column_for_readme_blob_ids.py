"""Add a column for README blob IDs

Revision ID: 858454adaad2
Revises: 9451a38411a1
Create Date: 2018-02-26 20:30:34.291693

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '858454adaad2'
down_revision = '9451a38411a1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('instance', sa.Column('readme_blob_id', sa.BigInteger(), nullable=True))
    op.create_index(op.f('ix_instance_readme_blob_id'), 'instance', ['readme_blob_id'], unique=False)
    op.create_foreign_key(None, 'instance', 's3_blob', ['readme_blob_id'], ['id'])


def downgrade():
    op.drop_index(op.f('ix_instance_readme_blob_id'), table_name='instance')
    op.drop_column('instance', 'readme_blob_id')
