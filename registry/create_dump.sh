#!/bin/bash

file="dump.sql"

echo "SET standard_conforming_strings = 'off';" > "$file"
mysqldump --complete-insert --no-create-info --skip-add-locks -u root --compatible=postgresql quilt --tables package instance s3_blob log version tag access invitation customer >> "$file"

for table in package s3_blob instance invitation log
do
    echo "SELECT setval('${table}_id_seq', (SELECT max(id) FROM $table));" >> "$file"
done
