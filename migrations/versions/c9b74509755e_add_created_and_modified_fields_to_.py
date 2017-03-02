"""Add created and modified fields to Instance

Revision ID: c9b74509755e
Revises: edfc8162889b
Create Date: 2017-03-01 16:20:28.215382

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'c9b74509755e'
down_revision = 'edfc8162889b'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('instance', sa.Column('created_by', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False))
    op.add_column('instance', sa.Column('created_at', sa.DateTime(), nullable=False))
    op.add_column('instance', sa.Column('updated_by', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False))
    op.add_column('instance', sa.Column('updated_at', sa.DateTime(), nullable=False))

    op.execute("""
        UPDATE instance JOIN (
            SELECT instance_id, min(created) min_created, max(created) max_created, author
            FROM log
            GROUP BY instance_id
        ) log
        ON id = instance_id
        SET created_at = min_created, created_by = author,
            updated_at = max_created, updated_by = author
    """)

def downgrade():
    op.drop_column('instance', 'updated_at')
    op.drop_column('instance', 'updated_by')
    op.drop_column('instance', 'created_at')
    op.drop_column('instance', 'created_by')
