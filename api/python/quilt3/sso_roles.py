import typing as T

import jsonschema.validators
import pydantic
import yaml
import yaml.parser


class Mapping(pydantic.BaseModel):
    json_schema: T.Union[bool, dict] = pydantic.Field(alias="schema")
    roles: list[str]
    admin: T.Optional[bool] = None

    def get_schema_validator(self):
        # XXX: use a single version or explicitly set default?
        return jsonschema.validators.validator_for(self.json_schema)

    def check_schema(self):
        self.get_schema_validator().check_schema(self.json_schema)

    def matches(self, id_token: dict) -> bool:
        return self.get_schema_validator().is_valid(id_token, self.json_schema)


class Config(pydantic.BaseModel):
    mappings: list[Mapping]



def load_config(data: bytes) -> Config:
    try:
        parsed_data = yaml.safe_load(data)
    except yaml.parser.ParserError as e:
        raise # XXX: wrap?
    try:
        config = Config.model_validate(parsed_data)
    except pydantic.ValidationError as e:
        raise # XXX: wrap?
    try:
        for m in config.mappings:
            m.check_schema()
    except jsonschema.SchemaError as e:
        raise # XXX: wrap?

    return config


def get_mapping(config: Config, id_token: dict) -> T.Optional[Mapping]:
    for mapping in config.mappings:
        if mapping.matches(id_token):
            return mapping
