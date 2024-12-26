# Generated by ariadne-codegen
# Source: queries.graphql

from pydantic import Field

from .base_model import BaseModel


class TabulatorSetOpenQuery(BaseModel):
    admin: "TabulatorSetOpenQueryAdmin"


class TabulatorSetOpenQueryAdmin(BaseModel):
    set_tabulator_open_query: "TabulatorSetOpenQueryAdminSetTabulatorOpenQuery" = Field(
        alias="setTabulatorOpenQuery"
    )


class TabulatorSetOpenQueryAdminSetTabulatorOpenQuery(BaseModel):
    tabulator_open_query: bool = Field(alias="tabulatorOpenQuery")


TabulatorSetOpenQuery.model_rebuild()
TabulatorSetOpenQueryAdmin.model_rebuild()
