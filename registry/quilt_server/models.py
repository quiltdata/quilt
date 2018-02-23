# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
DB Tables.
"""

from enum import IntEnum
from packaging.version import Version as PackagingVersion

from sqlalchemy.orm import deferred
from sqlalchemy.dialects import postgresql

from . import db

USERNAME_TYPE = db.String(64)

# https://stripe.com/docs/upgrades#what-changes-does-stripe-consider-to-be-backwards-compatible
STRIPE_ID_TYPE = db.String(255)

class Package(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    owner = db.Column(USERNAME_TYPE, nullable=False)
    name = db.Column(db.String(64), nullable=False)

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

    invitation = db.relationship(
        'Invitation', back_populates='package', cascade='save-update, merge, delete')

    def sort_key(self):
        return (self.owner, self.name)

db.Index('idx_owner_name', Package.owner, Package.name, unique=True)


InstanceBlobAssoc = db.Table(
    'instance_blob',
    db.Column('instance_id', db.BigInteger, db.ForeignKey('instance.id'), nullable=False),
    db.Column('blob_id', db.BigInteger, db.ForeignKey('s3_blob.id'), nullable=False),
    db.PrimaryKeyConstraint('instance_id', 'blob_id'),
)


class Instance(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), nullable=False)
    hash = db.Column(db.String(64), nullable=False)

    created_at = db.Column(postgresql.TIMESTAMP(True), server_default=db.func.now(), nullable=False)
    created_by = db.Column(USERNAME_TYPE, nullable=False)
    updated_at = db.Column(postgresql.TIMESTAMP(True), server_default=db.func.now(),
                           onupdate=db.func.now(), nullable=False)
    updated_by = db.Column(USERNAME_TYPE, nullable=False)

    # Contents can be a potentially large JSON blob, so load it lazily.
    contents = deferred(db.Column(postgresql.JSONB, nullable=False))

    package = db.relationship('Package', back_populates='instances')
    versions = db.relationship('Version', back_populates='instance')
    tags = db.relationship('Tag', back_populates='instance')
    blobs = db.relationship('S3Blob', secondary=InstanceBlobAssoc)

    @classmethod
    def readme_hash(cls):
        """Helper method for querying the hash of the README file"""
        return cls.contents['children']['README']['hashes'][0].astext  # pylint:disable=E1136

db.Index('idx_hash', Instance.package_id, Instance.hash, unique=True)


class S3Blob(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    owner = db.Column(USERNAME_TYPE, nullable=False)
    hash = db.Column(db.String(64), nullable=False)
    size = db.Column(db.BigInteger)

    preview = deferred(db.Column(db.TEXT))

    instances = db.relationship('Instance', secondary=InstanceBlobAssoc)

db.Index('idx', S3Blob.owner, S3Blob.hash, unique=True)


class Log(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), nullable=False, index=True)
    instance_id = db.Column(db.BigInteger, db.ForeignKey('instance.id'))
    created = db.Column(postgresql.TIMESTAMP(True), server_default=db.func.now(), nullable=False)
    author = db.Column(USERNAME_TYPE, nullable=False)

    package = db.relationship('Package', back_populates='logs')
    instance = db.relationship('Instance')


class Version(db.Model):
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), primary_key=True)
    version = db.Column(db.String(64), primary_key=True)
    instance_id = db.Column(db.BigInteger, db.ForeignKey('instance.id'))

    # Original version string, before normalization.
    user_version = db.Column(db.String(64), nullable=False)

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
    tag = db.Column(db.String(64), primary_key=True)
    instance_id = db.Column(db.BigInteger, db.ForeignKey('instance.id'))

    package = db.relationship('Package', back_populates='tags')
    instance = db.relationship('Instance', back_populates='tags')


class Access(db.Model):
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), primary_key=True)
    user = db.Column(USERNAME_TYPE, primary_key=True)

    package = db.relationship('Package', back_populates='access')


class Invitation(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'))
    email = db.Column(db.String(254), nullable=False)
    invited_at = db.Column(postgresql.TIMESTAMP(True), server_default=db.func.now(), nullable=False)

    package = db.relationship('Package', back_populates='invitation')


class Customer(db.Model):
    id = db.Column(USERNAME_TYPE, primary_key=True)
    stripe_customer_id = db.Column(STRIPE_ID_TYPE)


class Event(db.Model):
    class Type(IntEnum):
        PUSH = 1
        INSTALL = 2
        PREVIEW = 3
        DELETE = 4

        def __str__(self): return '%d' % self

    id = db.Column(db.BigInteger, primary_key=True)
    created = db.Column(postgresql.TIMESTAMP(True), server_default=db.func.now(), nullable=False, index=True)
    user = db.Column(USERNAME_TYPE, index=True)
    type = db.Column(db.SmallInteger, nullable=False)
    package_owner = db.Column(USERNAME_TYPE)
    package_name = db.Column(db.String(64))
    package_hash = db.Column(db.String(64))
    extra = db.Column(postgresql.JSONB)

db.Index('idx_package', Event.package_owner, Event.package_name)
