"""Upgrade the contents column from MEDIUMTEXT to LONGTEXT

Revision ID: 56eebc668baa
Revises: c78720167a07
Create Date: 2017-07-26 16:24:28.706812

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '56eebc668baa'
down_revision = 'c78720167a07'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('instance', 'contents',
               existing_type=mysql.MEDIUMTEXT(collation='utf8_bin'),
               type_=mysql.LONGTEXT(collation='utf8_bin'),
               existing_nullable=False)


def downgrade():
    op.alter_column('instance', 'contents',
               existing_type=mysql.LONGTEXT(collation='utf8_bin'),
               type_=mysql.MEDIUMTEXT(collation='utf8_bin'),
               existing_nullable=False)
