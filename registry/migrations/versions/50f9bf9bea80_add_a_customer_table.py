"""Add a Customer table

Revision ID: 50f9bf9bea80
Revises: c9b74509755e
Create Date: 2017-06-21 15:54:51.349413

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '50f9bf9bea80'
down_revision = 'c9b74509755e'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('customer',
    sa.Column('id', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
    sa.Column('stripe_customer_id', mysql.VARCHAR(collation='utf8_bin', length=255), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('customer')
