"""Add a full-text search index to S3Blob

Revision ID: 9576b2ed4073
Revises: 858454adaad2
Create Date: 2018-02-16 18:13:37.534812

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '9576b2ed4073'
down_revision = '858454adaad2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('s3_blob', sa.Column('preview_tsv', postgresql.TSVECTOR(), nullable=True))
    op.execute('UPDATE s3_blob SET preview_tsv = to_tsvector(preview)')
    op.create_index('idx_tsv', 's3_blob', ['preview_tsv'], unique=False, postgresql_using='gin')


def downgrade():
    op.drop_index('idx_tsv', table_name='s3_blob')
    op.drop_column('s3_blob', 'preview_tsv')
