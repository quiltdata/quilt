"""Add a tsv for the instance contents

Revision ID: 0df25c7758bf
Revises: 9576b2ed4073
Create Date: 2018-03-13 14:49:51.719830

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0df25c7758bf'
down_revision = '9576b2ed4073'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('instance', sa.Column('keywords_tsv', postgresql.TSVECTOR(), nullable=True))
    op.create_index('idx_keywords_tsv', 'instance', ['keywords_tsv'], unique=False, postgresql_using='gin')


def downgrade():
    op.drop_index('idx_keywords_tsv', table_name='instance')
    op.drop_column('instance', 'keywords_tsv')
