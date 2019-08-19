#!/usr/bin/env python3

import json
from jsonschema import Draft4Validator

schema = None
schema_path = "./config-schema.json"
with open(schema_path, "r") as schema_file:
    schema = json.load(schema_file)

config_path = "./config.json.tmpl"
with open(config_path, "r") as config_file:
    catalog_config = json.load(config_file)

assert schema and catalog_config
Draft4Validator(schema).validate(catalog_config)

print(f"Successfully validated {config_path} against {schema_path}")
