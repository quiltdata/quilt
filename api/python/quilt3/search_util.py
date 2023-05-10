"""
search_util.py

Contains search-related glue code
"""
from . import session


def search_api(query, index, limit=10):
    """
    Sends a query to the search API (supports simple search
    queries only)
    """
    response = session.get_session().get(
        f"{session.get_registry_url()}/api/search",
        params=dict(index=index, action='search', query=query, size=limit),
    )
    return response.json()
