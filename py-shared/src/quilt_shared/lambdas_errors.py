from __future__ import annotations

import typing as T

if T.TYPE_CHECKING:
    import botocore.exceptions


class LambdaError(Exception):
    def __init__(self, name: str, context: T.Optional[dict] = None):
        super().__init__(name, context)
        self.name = name
        self.context = context

    def dict(self):
        return {"name": self.name, "context": self.context}

    @classmethod
    def from_boto_error(cls, boto_error: botocore.exceptions.ClientError):
        boto_response = boto_error.response
        status_code = boto_response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        error_code = boto_response.get("Error", {}).get("Code")
        error_message = boto_response.get("Error", {}).get("Message")
        return cls(
            "AWSError",
            {
                "status_code": status_code,
                "error_code": error_code,
                "error_message": error_message,
            },
        )
