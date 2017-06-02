#!/usr/bin/env python

"""
Changes the object layout in S3 from user/package/hash to user/hash.
Only copies the objects; does not delete the old ones. Safe to run multiple times.
"""

import argparse
import sys

import boto3

OBJ_DIR = 'objs'

def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true',
                        help="Don't do anything, just print the changes")
    parser.add_argument('s3_bucket', type=str)

    args = parser.parse_args()

    s3_client = boto3.client('s3')
    result = s3_client.list_objects_v2(Bucket=args.s3_bucket)
    if result['IsTruncated']:
        print("Too many objects! Need to paginate.")
        return 1

    contents_by_key = dict()
    old_object_keys = set()

    # Collect all of the object keys.
    for obj in result['Contents']:
        key = tuple(obj['Key'].split('/'))
        contents_by_key[key] = obj

        if len(key) != 3:
            print("Unexpected key: %r" % '/'.join(key))
            return 1

        if key[0] != OBJ_DIR:
            old_object_keys.add(key)

    # Collect objects to be copied. Make sure there is nothing unexpected.
    objects_to_copy = dict()
    for user, package, obj_hash in old_object_keys:
        old_key = (user, package, obj_hash)
        new_key = (OBJ_DIR, user, obj_hash)
        old_obj = contents_by_key.get(old_key)
        duplicate_old_obj = objects_to_copy.get(new_key)
        duplicate_new_obj = contents_by_key.get(new_key)
        if duplicate_new_obj is not None:
            if duplicate_new_obj['Size'] != old_obj['Size']:
                print("Size mismatch: %s and %s" % (old_obj['Key'], duplicate_new_obj['Key']))
                return 1
            print("Skipping %s; new object %s already exits." %
                  (old_obj['Key'], duplicate_new_obj['Key']))
        elif duplicate_old_obj is not None:
            if duplicate_old_obj['Size'] != old_obj['Size']:
                print("Size mismatch: %s and %s" % (old_obj['Key'], duplicate_old_obj['Key']))
                return 1
            print("Skipping %s; object %s will be used instead." %
                  (old_obj['Key'], duplicate_old_obj['Key']))
        else:
            objects_to_copy[new_key] = old_obj

    # Actually copy the objects.
    for key, obj in objects_to_copy.items():
        old_key = obj['Key']
        new_key = '/'.join(key)
        print("Copying %s to %s..." % (old_key, new_key))
        if not args.dry_run:
            s3_client.copy_object(
                Bucket=args.s3_bucket,
                CopySource=dict(
                    Bucket=args.s3_bucket,
                    Key=old_key,
                ),
                Key=new_key,
            )

    print("Done!")

    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
