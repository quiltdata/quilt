# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
DB Tables.
"""

from packaging.version import Version as PackagingVersion

from sqlalchemy.dialects import mysql
from sqlalchemy.orm import deferred

from . import db

UTF8_BIN = 'utf8_bin'
UTF8_GENERAL_CI = 'utf8_general_ci'

def CaseSensitiveString(length):
    return mysql.VARCHAR(length, collation=UTF8_BIN)

USERNAME_TYPE = CaseSensitiveString(64)

# https://stripe.com/docs/upgrades#what-changes-does-stripe-consider-to-be-backwards-compatible
STRIPE_ID_TYPE = CaseSensitiveString(255)

class Package(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    owner = db.Column(USERNAME_TYPE, nullable=False)
    name = db.Column(CaseSensitiveString(64), nullable=False)

    logs = db.relationship(
        'Log', back_populates='package', cascade='save-update, merge, delete')

    instances = db.relationship(
        'Instance', back_populates='package', cascade='save-update, merge, delete')
    versions = db.relationship(
        'Version', back_populates='package', cascade='save-update, merge, delete')
    tags = db.relationship(
        'Tag', back_populates='package', cascade='save-update, merge, delete')

    access = db.relationship(
        'Access', back_populates='package', cascade='save-update, merge, delete')

    def sort_key(self):
        return (self.owner, self.name)

db.Index('idx_owner_name', Package.owner, Package.name, unique=True)


InstanceBlobAssoc = db.Table(
    'instance_blob',
    db.Column('instance_id', db.BigInteger, db.ForeignKey('instance.id')),
    db.Column('blob_id', db.BigInteger, db.ForeignKey('s3_blob.id'))
)


class Instance(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), nullable=False)
    hash = db.Column(db.String(64), nullable=False)

    created_at = db.Column(db.DateTime, default=db.func.utc_timestamp(), nullable=False)
    created_by = db.Column(USERNAME_TYPE, nullable=False)
    updated_at = db.Column(db.DateTime, default=db.func.utc_timestamp(),
                           onupdate=db.func.utc_timestamp(), nullable=False)
    updated_by = db.Column(USERNAME_TYPE, nullable=False)

    # Contents can be a potentially large JSON blob, so store it as
    # MEDIUMTEXT rather than VARCHAR, and load lazily.
    contents = deferred(db.Column(mysql.MEDIUMTEXT(collation=UTF8_BIN), nullable=False))

    package = db.relationship('Package', back_populates='instances')
    versions = db.relationship('Version', back_populates='instance')
    tags = db.relationship('Tag', back_populates='instance')
    blobs = db.relationship('S3Blob', secondary=InstanceBlobAssoc)

db.Index('idx_hash', Instance.package_id, Instance.hash, unique=True)


class S3Blob(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    owner = db.Column(USERNAME_TYPE, nullable=False)
    hash = db.Column(db.String(64), nullable=False)

db.Index('idx', S3Blob.owner, S3Blob.hash, unique=True)


class Log(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), nullable=False, index=True)
    instance_id = db.Column(db.BigInteger, db.ForeignKey('instance.id'))
    created = db.Column(db.DateTime, default=db.func.utc_timestamp(), nullable=False)
    author = db.Column(USERNAME_TYPE, nullable=False)

    package = db.relationship('Package', back_populates='logs')
    instance = db.relationship('Instance')


class Version(db.Model):
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), primary_key=True)
    version = db.Column(CaseSensitiveString(64), primary_key=True)
    instance_id = db.Column(db.BigInteger, db.ForeignKey('instance.id'))

    # Original version string, before normalization.
    user_version = db.Column(CaseSensitiveString(64), nullable=False)

    package = db.relationship('Package', back_populates='versions')
    instance = db.relationship('Instance', back_populates='versions')

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
    instance_id = db.Column(db.BigInteger, db.ForeignKey('instance.id'))

    package = db.relationship('Package', back_populates='tags')
    instance = db.relationship('Instance', back_populates='tags')


class Access(db.Model):
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), primary_key=True)
    user = db.Column(USERNAME_TYPE, primary_key=True)

    package = db.relationship('Package', back_populates='access')


class Customer(db.Model):
    id = db.Column(USERNAME_TYPE, primary_key=True)
    stripe_customer_id = db.Column(STRIPE_ID_TYPE)
