#!/usr/bin/env python3

from jsonschema import Draft4Validator

schema_path = "./config-schema.json"
schema = json.loads(open(schema_path).read().decode("utf-8"))

config_path = "./config.json.tmpl"
catalog_config = json.loads(open(config_path).read().decode("utf-8"))
Draft4Validator(schema).validate(catalog_config)
