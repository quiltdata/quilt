# Generated by ariadne-codegen
# Source: queries.graphql

from pydantic import Field

from .base_model import BaseModel


class TabulatorGetOpenQuery(BaseModel):
    admin: "TabulatorGetOpenQueryAdmin"


class TabulatorGetOpenQueryAdmin(BaseModel):
    tabulator_open_query: bool = Field(alias="tabulatorOpenQuery")


TabulatorGetOpenQuery.model_rebuild()
