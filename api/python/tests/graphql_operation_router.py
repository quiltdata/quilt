"""
GraphQL Operation Router for testing admin functionality.

Provides a lightweight operation router that matches GraphQL operations to predefined responses
without the overhead of a full server.
"""

import re
from typing import Any, Dict, List, Optional


class GraphQLOperationRouter:
    """Routes GraphQL operations to mock responses for testing."""

    def __init__(self):
        self.responses: Dict[str, Any] = {}
        self.call_history: List[Dict[str, Any]] = []

    def add_response(self, operation_name: str, response: Dict[str, Any]) -> None:
        """Add a mock response for a GraphQL operation.

        Args:
            operation_name: The GraphQL operation name (e.g., "usersList", "usersCreate")
            response: The response data to return for this operation
        """
        self.responses[operation_name] = response

    def route_operation(self, query: str, operation_name: str = None, variables: Dict[str, Any] = None) -> Any:
        """Route a GraphQL operation to the appropriate mock response.

        Args:
            query: The GraphQL query string
            operation_name: Optional operation name (extracted from query if not provided)
            variables: GraphQL variables for the operation

        Returns:
            Mock response data for the operation

        Raises:
            KeyError: If no response is configured for the operation
        """
        if variables is None:
            variables = {}

        # Extract operation name from query if not provided
        if not operation_name:
            operation_name = self._extract_operation_name(query)

        # Record the call for history tracking
        self.call_history.append({"query": query, "operation_name": operation_name, "variables": variables})

        if operation_name not in self.responses:
            raise KeyError(f"No mock response configured for operation: {operation_name}")

        return self.responses[operation_name]

    def _extract_operation_name(self, query: str) -> str:
        """Extract operation name from GraphQL query.

        Args:
            query: GraphQL query string

        Returns:
            Operation name extracted from the query

        Raises:
            ValueError: If operation name cannot be extracted
        """
        # Match patterns like "query usersList" or "mutation usersCreate"
        match = re.search(r'(?:query|mutation)\s+(\w+)', query)
        if match:
            return match.group(1)

        raise ValueError(f"Could not extract operation name from query: {query}")

    def get_call_count(self, operation_name: str) -> int:
        """Get the number of times an operation was called.

        Args:
            operation_name: The operation name to count

        Returns:
            Number of times the operation was called
        """
        return sum(1 for call in self.call_history if call["operation_name"] == operation_name)

    def get_last_call(self, operation_name: str) -> Optional[Dict[str, Any]]:
        """Get the last call made for an operation.

        Args:
            operation_name: The operation name to get the last call for

        Returns:
            Last call data or None if operation was never called
        """
        for call in reversed(self.call_history):
            if call["operation_name"] == operation_name:
                return call
        return None

    def reset(self) -> None:
        """Reset the router state, clearing responses and call history."""
        self.responses.clear()
        self.call_history.clear()
