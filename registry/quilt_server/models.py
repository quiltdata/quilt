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

    comments = db.relationship(
        'Comment', back_populates='package', cascade='save-update, merge, delete')

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
    updated_at = db.Column(postgresql.TIMESTAMP(True), server_default=db.func.now(), nullable=False)
    updated_by = db.Column(USERNAME_TYPE, nullable=False)

    # Contents can be a potentially large JSON blob, so load it lazily.
    contents = deferred(db.Column(postgresql.JSONB, nullable=False))

    readme_blob_id = db.Column(db.BigInteger, db.ForeignKey('s3_blob.id'), index=True)

    # TSVector of the owner, name, and useful parts of the JSON contents.
    keywords_tsv = deferred(db.Column(postgresql.TSVECTOR, nullable=False, server_default=''))

    # TSVector of the README blob; needs to be in the Instance table in order for the index to work.
    blobs_tsv = deferred(db.Column(postgresql.TSVECTOR, nullable=False, server_default=''))

    package = db.relationship('Package', back_populates='instances')
    versions = db.relationship('Version', back_populates='instance')
    tags = db.relationship('Tag', back_populates='instance')
    blobs = db.relationship('S3Blob', secondary=InstanceBlobAssoc)

    readme_blob = db.relationship('S3Blob', uselist=False)

db.Index('idx_hash', Instance.package_id, Instance.hash, unique=True)
db.Index('idx_keywords_tsv', Instance.keywords_tsv, postgresql_using='gin')  # UNUSED
db.Index('idx_keywords_blobs_tsv', Instance.keywords_tsv.op('||')(Instance.blobs_tsv), postgresql_using='gin')


class S3Blob(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    owner = db.Column(USERNAME_TYPE, nullable=False)
    hash = db.Column(db.String(64), nullable=False)
    size = db.Column(db.BigInteger)

    # Preview of the content - only used for the READMEs.
    preview = deferred(db.Column(db.TEXT))

    # Only used for READMEs right now - but could be used for anything, including blobs
    # for which we're not storing a preview (therefore it's a separate column).
    # UNUSED: Delete in the next update.
    preview_tsv = deferred(db.Column(postgresql.TSVECTOR))

    instances = db.relationship('Instance', secondary=InstanceBlobAssoc)

db.Index('idx', S3Blob.owner, S3Blob.hash, unique=True)
db.Index('idx_tsv', S3Blob.preview_tsv, postgresql_using='gin')


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

class User(db.Model):
    id = db.Column(postgresql.UUID, primary_key=True)
    name = db.Column(db.String(64), unique=True)
    email = db.Column(db.String(64), unique=True) # should this be longer?
    password = db.Column(db.String(200))
    is_admin = db.Column(db.Boolean, default=False)
    last_login = db.Column(postgresql.TIMESTAMP(True), server_default=db.func.now())
    first_name = db.Column(db.String(64))
    last_name = db.Column(db.String(64))
    is_active = db.Column(db.Boolean, default=True)
    date_joined = db.Column(postgresql.TIMESTAMP(True), server_default=db.func.now(), nullable=False)
    old_id = db.Column(db.BigInteger) # for django ID -- probably not necessary but good to keep around

class Code(db.Model):
    # each user can have only one code, so only user_id is primary key
    user_id = db.Column(postgresql.UUID, db.ForeignKey('user.id'), primary_key=True)
    code = db.Column(postgresql.UUID, nullable=False)

class Token(db.Model):
    # each user can have an arbitrary number of tokens, so 
    #   both user_id and token are primary keys
    user_id = db.Column(postgresql.UUID, db.ForeignKey('user.id'), primary_key=True)
    token = db.Column(postgresql.UUID, primary_key=True)

MAX_COMMENT_LENGTH = 10 * 1024

class Comment(db.Model):
    id = db.Column(db.BigInteger, primary_key=True)
    package_id = db.Column(db.BigInteger, db.ForeignKey('package.id'), nullable=False, index=True)
    author = db.Column(USERNAME_TYPE, nullable=False)
    created = db.Column(postgresql.TIMESTAMP(True), server_default=db.func.now(), nullable=False, index=True)
    contents = db.Column(db.String(MAX_COMMENT_LENGTH), nullable=False)

    package = db.relationship('Package', back_populates='comments')
