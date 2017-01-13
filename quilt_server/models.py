"""
DB Tables.
"""

from . import db


USERNAME_TYPE = db.String(64)

class Package(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    owner = db.Column(USERNAME_TYPE, nullable=False)
    name = db.Column(db.String(64), nullable=False)

    versions = db.relationship('Version', back_populates='package')

db.Index('idx_package', Package.owner, Package.name, unique=True)

class Version(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    package_id = db.Column(db.Integer, db.ForeignKey('package.id'))
    created = db.Column(db.DateTime, default=db.func.utc_timestamp())
    author = db.Column(USERNAME_TYPE, nullable=False)
    hash = db.Column(db.String(64), nullable=False)
    s3_bucket = db.Column(db.String(64), nullable=False)
    s3_path = db.Column(db.String(256), nullable=False)
    deleted = db.Column(db.Boolean, default=False)

    package = db.relationship('Package', back_populates='versions')
