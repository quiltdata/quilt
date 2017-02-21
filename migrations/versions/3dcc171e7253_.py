"""empty message

Revision ID: 3dcc171e7253
Revises: 5aa9baabd014
Create Date: 2017-02-17 20:02:37.377041

"""
from alembic import op
from packaging.version import Version as PackagingVersion
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from quilt_server import db
from quilt_server.models import Version

# revision identifiers, used by Alembic.
revision = '3dcc171e7253'
down_revision = '5aa9baabd014'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('version', sa.Column('user_version', mysql.VARCHAR(collation='utf8_bin', length=64), nullable=True))

    for row in Version.query.all():
        row.user_version = row.version
        row.version = str(PackagingVersion(row.user_version))

    db.session.commit()

def downgrade():
    for row in Version.query.all():
        row.version = row.user_version

    db.session.commit()

    op.drop_column('version', 'user_version')
