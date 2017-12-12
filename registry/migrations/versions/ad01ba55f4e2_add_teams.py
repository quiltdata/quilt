"""Add teams

Revision ID: ad01ba55f4e2
Revises: 6b0f5d5cf148
Create Date: 2017-12-12 23:53:20.746083

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'ad01ba55f4e2'
down_revision = '6b0f5d5cf148'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'team',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('name', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_team_name'), 'team', ['name'], unique=False)
    op.create_table(
        'user_team',
        sa.Column('user', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
        sa.Column('team_id', sa.BigInteger(), nullable=False),
        sa.Column('is_admin', mysql.TINYINT(1), nullable=False),
        sa.ForeignKeyConstraint(['team_id'], ['team.id'], ),
        sa.PrimaryKeyConstraint('user')
    )
    op.add_column('package', sa.Column('team_id', sa.BigInteger(), nullable=True))

    op.create_index('idx_team_owner_name', 'package', ['team_id', 'owner', 'name'], unique=True)
    op.drop_index('idx_owner_name', table_name='package')
    op.create_index('idx_owner_name', 'package', ['team_id', 'owner', 'name'], unique=False)

    op.create_foreign_key('package_team_id', 'package', 'team', ['team_id'], ['id'])

def downgrade():
    op.drop_constraint('package_team_id', 'package', type_='foreignkey')

    op.drop_index('idx_owner_name', table_name='package')
    op.create_index('idx_owner_name', 'package', ['owner', 'name'], unique=True)
    op.drop_index('idx_team_owner_name', table_name='package')

    op.drop_column('package', 'team_id')
    op.drop_table('user_team')
    op.drop_index(op.f('ix_team_name'), table_name='team')
    op.drop_table('team')
