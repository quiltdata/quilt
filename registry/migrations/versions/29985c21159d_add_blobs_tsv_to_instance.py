"""Add blobs_tsv to Instance

Revision ID: 29985c21159d
Revises: 0df25c7758bf
Create Date: 2018-03-29 16:50:04.430250

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '29985c21159d'
down_revision = '0df25c7758bf'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('instance', sa.Column('blobs_tsv', postgresql.TSVECTOR(), nullable=False, server_default=''))
    op.alter_column('instance', 'keywords_tsv', existing_type=postgresql.TSVECTOR(), nullable=False, server_default='')
    op.create_index('idx_keywords_blobs_tsv', 'instance', [sa.text('(keywords_tsv || blobs_tsv)')], unique=False, postgresql_using='gin')

def downgrade():
    op.drop_index('idx_keywords_blobs_tsv', table_name='instance')
    op.alter_column('instance', 'keywords_tsv', existing_type=postgresql.TSVECTOR(), nullable=True)
    op.drop_column('instance', 'blobs_tsv')
