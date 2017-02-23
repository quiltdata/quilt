"""Initial schema

Revision ID: edfc8162889b
Revises: 
Create Date: 2017-02-22 18:15:17.661305

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'edfc8162889b'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('package',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('owner', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
    sa.Column('name', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_owner_name', 'package', ['owner', 'name'], unique=True)
    op.create_table('s3_blob',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('owner', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
    sa.Column('hash', sa.String(length=64), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx', 's3_blob', ['owner', 'hash'], unique=True)
    op.create_table('access',
    sa.Column('package_id', sa.BigInteger(), nullable=False),
    sa.Column('user', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
    sa.ForeignKeyConstraint(['package_id'], ['package.id'], ),
    sa.PrimaryKeyConstraint('package_id', 'user')
    )
    op.create_table('instance',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('package_id', sa.BigInteger(), nullable=False),
    sa.Column('hash', sa.String(length=64), nullable=False),
    sa.Column('contents', mysql.MEDIUMTEXT(collation='utf8_bin'), nullable=False),
    sa.ForeignKeyConstraint(['package_id'], ['package.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_hash', 'instance', ['package_id', 'hash'], unique=True)
    op.create_table('instance_blob',
    sa.Column('instance_id', sa.BigInteger(), nullable=True),
    sa.Column('blob_id', sa.BigInteger(), nullable=True),
    sa.ForeignKeyConstraint(['blob_id'], ['s3_blob.id'], ),
    sa.ForeignKeyConstraint(['instance_id'], ['instance.id'], )
    )
    op.create_table('log',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('package_id', sa.BigInteger(), nullable=False),
    sa.Column('instance_id', sa.BigInteger(), nullable=True),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('author', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
    sa.ForeignKeyConstraint(['instance_id'], ['instance.id'], ),
    sa.ForeignKeyConstraint(['package_id'], ['package.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_log_package_id'), 'log', ['package_id'], unique=False)
    op.create_table('tag',
    sa.Column('package_id', sa.BigInteger(), nullable=False),
    sa.Column('tag', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
    sa.Column('instance_id', sa.BigInteger(), nullable=True),
    sa.ForeignKeyConstraint(['instance_id'], ['instance.id'], ),
    sa.ForeignKeyConstraint(['package_id'], ['package.id'], ),
    sa.PrimaryKeyConstraint('package_id', 'tag')
    )
    op.create_table('version',
    sa.Column('package_id', sa.BigInteger(), nullable=False),
    sa.Column('version', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
    sa.Column('instance_id', sa.BigInteger(), nullable=True),
    sa.Column('user_version', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=False),
    sa.ForeignKeyConstraint(['instance_id'], ['instance.id'], ),
    sa.ForeignKeyConstraint(['package_id'], ['package.id'], ),
    sa.PrimaryKeyConstraint('package_id', 'version')
    )


def downgrade():
    assert False  # Just in case...

    op.drop_table('version')
    op.drop_table('tag')
    op.drop_table('log')
    op.drop_table('instance_blob')
    op.drop_table('instance')
    op.drop_table('access')
    op.drop_table('s3_blob')
    op.drop_table('package')
