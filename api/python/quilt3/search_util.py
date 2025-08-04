"""
search_util.py

Contains search-related glue code
"""
import json
import typing as T

from . import session


def search_api(query: T.Union[str, dict], index: str, limit: int = 10):
    """
    Send a query to the search API
    """
    if isinstance(query, dict):
        params = dict(index=index, action="freeform", body=json.dumps(query), size=limit)
    else:
        params = dict(index=index, action="search", query=query, size=limit)
    response = session.get_session().get(
        f"{session.get_registry_url()}/api/search",
        params=params,
    )
    return response.json()
