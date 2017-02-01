"""
DB Tables.
"""

from . import db


USERNAME_TYPE = db.String(64)

class Package(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    owner = db.Column(USERNAME_TYPE, nullable=False)
    name = db.Column(db.String(64), nullable=False)

    versions = db.relationship('Version', back_populates='package')
    tags = db.relationship('Tag', back_populates='package')

db.Index('idx_package', Package.owner, Package.name, unique=True)


class Version(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'))
    hash = db.Column(db.String(128), nullable=False, index=True)
    created = db.Column(db.DateTime, default=db.func.utc_timestamp())
    author = db.Column(USERNAME_TYPE, nullable=False)
    deleted = db.Column(db.Boolean, default=False)

    package = db.relationship('Package', back_populates='versions')
    tag = db.relationship('Tag', back_populates='version')


class Tag(db.Model):
    LATEST = "latest"

    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), primary_key=True)
    tag = db.Column(db.String(64), primary_key=True)
    version_id = db.Column(db.BigInteger, db.ForeignKey('version.id'))

    package = db.relationship('Package', back_populates='tags')
    version = db.relationship('Version', back_populates='tag')


class Access(db.Model):
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), primary_key=True)
    user = db.Column(USERNAME_TYPE, primary_key=True)
    
