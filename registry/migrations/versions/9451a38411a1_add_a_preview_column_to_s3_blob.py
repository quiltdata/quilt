"""Add a preview column to s3_blob

Revision ID: 9451a38411a1
Revises: 6daddb340397
Create Date: 2018-02-07 16:44:54.309904

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9451a38411a1'
down_revision = '6daddb340397'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('s3_blob', sa.Column('preview', sa.TEXT(), nullable=True))


def downgrade():
    op.drop_column('s3_blob', 'preview')
