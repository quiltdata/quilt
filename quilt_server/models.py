"""
DB Tables.
"""

from packaging.version import Version as PackagingVersion

from sqlalchemy.dialects import mysql

from . import db

UTF8_BIN = 'utf8_bin'
UTF8_GENERAL_CI = 'utf8_general_ci'

def CaseSensitiveString(length):
    return mysql.VARCHAR(length, collation=UTF8_BIN)

USERNAME_TYPE = CaseSensitiveString(64)

class Package(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    owner = db.Column(USERNAME_TYPE, nullable=False)
    name = db.Column(CaseSensitiveString(64), nullable=False)

    logs = db.relationship('Log', back_populates='package')

    blobs = db.relationship('Blob', back_populates='package')
    versions = db.relationship('Version', back_populates='package')
    tags = db.relationship('Tag', back_populates='package')

    access = db.relationship('Access', back_populates='package')

db.Index('idx_package', Package.owner, Package.name, unique=True)


class Blob(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), nullable=False)
    hash = db.Column(db.String(64), nullable=False)

    package = db.relationship('Package', back_populates='blobs')
    versions = db.relationship('Version', back_populates='blob')
    tags = db.relationship('Tag', back_populates='blob')

db.Index('idx_blob', Blob.package_id, Blob.hash, unique=True)


class Log(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), nullable=False, index=True)
    blob_id = db.Column(db.BigInteger, db.ForeignKey('blob.id'))
    created = db.Column(db.DateTime, default=db.func.utc_timestamp(), nullable=False)
    author = db.Column(USERNAME_TYPE, nullable=False)

    package = db.relationship('Package', back_populates='logs')
    blob = db.relationship('Blob')


class Version(db.Model):
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), primary_key=True)
    version = db.Column(CaseSensitiveString(64), primary_key=True)
    blob_id = db.Column(db.BigInteger, db.ForeignKey('blob.id'))

    # Original version string, before normalization.
    user_version = db.Column(CaseSensitiveString(64), nullable=False)

    package = db.relationship('Package', back_populates='versions')
    blob = db.relationship('Blob', back_populates='versions')

    @classmethod
    def normalize(cls, v):
        # TODO: Trailing '.0's should be ignored - i.e., "1.2.0" == "1.2" - however,
        # `packaging.version` does not seem to expose any functions to deal with that.

        return str(PackagingVersion(v))

    def sort_key(self):
        return PackagingVersion(self.version)

class Tag(db.Model):
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), primary_key=True)
    tag = db.Column(CaseSensitiveString(64), primary_key=True)
    blob_id = db.Column(db.BigInteger, db.ForeignKey('blob.id'))

    package = db.relationship('Package', back_populates='tags')
    blob = db.relationship('Blob', back_populates='tags')


class Access(db.Model):
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), primary_key=True)
    user = db.Column(USERNAME_TYPE, primary_key=True)

    package = db.relationship('Package', back_populates='access')
