#!/usr/bin/env python3

"""
Fix the missing entries in InstanceBlobAssoc.
"""

import json

from sqlalchemy.orm import undefer


from quilt_server import db
from quilt_server.core import find_object_hashes
from quilt_server.models import Instance, InstanceBlobAssoc, S3Blob

instances = db.session.query(Instance).options(undefer('contents')).all()
blobs = { blob.hash: blob for blob in db.session.query(S3Blob) }
instance_blobs = { (ib.instance_id, ib.blob_id) for ib in db.session.query(InstanceBlobAssoc) }

for idx, instance in enumerate(instances):
    print("Processing %d (%d/%d)..." % (instance.id, idx + 1, len(instances)))

    missing = []
    hashes = set(find_object_hashes(instance.contents))

    for obj_hash in hashes:
        blob = blobs[obj_hash]
        if (instance.id, blob.id) not in instance_blobs:
            print("Missing: %d-%d" % (instance.id, blob.id))
            missing.append(dict(instance_id=instance.id, blob_id=blob.id))

    if missing:
        db.session.execute(InstanceBlobAssoc.insert(), missing)
        db.session.commit()

print("Done")
