"""
Tests for GraphQL base client functionality.

Comprehensive test coverage for the GraphQL base client and base model classes.
"""

import io
import json
from unittest import mock
from unittest.mock import MagicMock, Mock, patch

import pytest
import requests
from pydantic import BaseModel

from quilt3._graphql_client.base_client import BaseClient
from quilt3._graphql_client.base_model import UNSET, UnsetType, Upload
from quilt3._graphql_client.exceptions import (
    GraphQLClientGraphQLMultiError, GraphQLClientHttpError,
    GraphQLClientInvalidResponseError)

from .utils import QuiltTestCase


class TestUnsetType(QuiltTestCase):
    """Test the UnsetType class."""

    def test_unset_type_bool(self):
        """Test that UnsetType evaluates to False."""
        unset = UnsetType()
        self.assertFalse(unset)
        self.assertFalse(bool(unset))

    def test_unset_constant(self):
        """Test that UNSET is an instance of UnsetType."""
        self.assertIsInstance(UNSET, UnsetType)
        self.assertFalse(UNSET)


class TestUpload(QuiltTestCase):
    """Test the Upload class."""

    def test_upload_creation(self):
        """Test Upload object creation."""
        content = io.BytesIO(b"test content")
        upload = Upload("test.txt", content, "text/plain")
        
        self.assertEqual(upload.filename, "test.txt")
        self.assertEqual(upload.content, content)
        self.assertEqual(upload.content_type, "text/plain")

    def test_upload_with_different_content_types(self):
        """Test Upload with various content types."""
        content = io.BytesIO(b"image data")
        upload = Upload("image.png", content, "image/png")
        
        self.assertEqual(upload.filename, "image.png")
        self.assertEqual(upload.content_type, "image/png")


class TestBaseClient(QuiltTestCase):
    """Test the BaseClient class."""

    def setUp(self):
        super().setUp()
        self.mock_session = Mock()
        self.mock_response = Mock()
        self.mock_session.post.return_value = self.mock_response
        
        # Mock the session.get_session() and session.get_registry_url()
        self.session_patcher = patch('quilt3._graphql_client.base_client.session')
        self.mock_session_module = self.session_patcher.start()
        self.mock_session_module.get_session.return_value = self.mock_session
        self.mock_session_module.get_registry_url.return_value = "https://api.example.com"

    def tearDown(self):
        self.session_patcher.stop()
        super().tearDown()

    def test_base_client_initialization(self):
        """Test BaseClient initialization."""
        client = BaseClient()
        
        self.assertEqual(client.url, "https://api.example.com/graphql")
        self.assertEqual(client.http_client, self.mock_session)
        self.mock_session_module.get_session.assert_called_once()
        self.mock_session_module.get_registry_url.assert_called_once()

    def test_context_manager_enter(self):
        """Test BaseClient as context manager (enter)."""
        client = BaseClient()
        with client as c:
            self.assertIs(c, client)

    def test_context_manager_exit(self):
        """Test BaseClient as context manager (exit)."""
        client = BaseClient()
        with client:
            pass
        self.mock_session.close.assert_called_once()

    def test_execute_json_simple_query(self):
        """Test executing a simple JSON GraphQL query."""
        client = BaseClient()
        query = "query { user { name } }"
        
        client.execute(query)
        
        # Verify the request was made correctly
        self.mock_session.post.assert_called_once()
        call_args = self.mock_session.post.call_args
        
        self.assertEqual(call_args[1]["url"], "https://api.example.com/graphql")
        
        # Check the request data
        request_data = json.loads(call_args[1]["data"])
        self.assertEqual(request_data["query"], query)
        self.assertIsNone(request_data["operationName"])
        self.assertEqual(request_data["variables"], {})

    def test_execute_with_operation_name_and_variables(self):
        """Test executing query with operation name and variables."""
        client = BaseClient()
        query = "query GetUser($id: ID!) { user(id: $id) { name } }"
        operation_name = "GetUser"
        variables = {"id": "123"}
        
        client.execute(query, operation_name=operation_name, variables=variables)
        
        # Check the request data
        call_args = self.mock_session.post.call_args
        request_data = json.loads(call_args[1]["data"])
        
        self.assertEqual(request_data["query"], query)
        self.assertEqual(request_data["operationName"], operation_name)
        self.assertEqual(request_data["variables"], variables)

    def test_execute_with_additional_headers(self):
        """Test executing query with additional headers."""
        client = BaseClient()
        query = "query { user { name } }"
        custom_headers = {"X-Custom-Header": "custom-value"}
        
        client.execute(query, headers=custom_headers)
        
        # Check that headers were merged
        call_args = self.mock_session.post.call_args
        headers = call_args[1]["headers"]
        
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertEqual(headers["X-Custom-Header"], "custom-value")

    def test_get_data_successful_response(self):
        """Test get_data with successful response."""
        client = BaseClient()
        
        # Mock successful response
        self.mock_response.status_code = 200
        self.mock_response.json.return_value = {
            "data": {"user": {"name": "John Doe"}}
        }
        
        data = client.get_data(self.mock_response)
        
        self.assertEqual(data, {"user": {"name": "John Doe"}})

    def test_get_data_http_error(self):
        """Test get_data with HTTP error status."""
        client = BaseClient()
        
        # Mock HTTP error response
        self.mock_response.status_code = 500
        
        with self.assertRaises(GraphQLClientHttpError) as context:
            client.get_data(self.mock_response)
        
        self.assertEqual(context.exception.status_code, 500)
        self.assertEqual(context.exception.response, self.mock_response)

    def test_get_data_invalid_json(self):
        """Test get_data with invalid JSON response."""
        client = BaseClient()
        
        # Mock response with invalid JSON
        self.mock_response.status_code = 200
        self.mock_response.json.side_effect = ValueError("Invalid JSON")
        
        with self.assertRaises(GraphQLClientInvalidResponseError) as context:
            client.get_data(self.mock_response)
        
        self.assertEqual(context.exception.response, self.mock_response)

    def test_get_data_invalid_response_format(self):
        """Test get_data with invalid response format."""
        client = BaseClient()
        
        # Mock response with invalid format (not dict or missing data/errors)
        self.mock_response.status_code = 200
        self.mock_response.json.return_value = ["not", "a", "dict"]
        
        with self.assertRaises(GraphQLClientInvalidResponseError):
            client.get_data(self.mock_response)

    def test_get_data_missing_data_and_errors(self):
        """Test get_data with response missing both data and errors."""
        client = BaseClient()
        
        # Mock response missing both data and errors
        self.mock_response.status_code = 200
        self.mock_response.json.return_value = {"something": "else"}
        
        with self.assertRaises(GraphQLClientInvalidResponseError):
            client.get_data(self.mock_response)

    def test_get_data_with_graphql_errors(self):
        """Test get_data with GraphQL errors."""
        client = BaseClient()
        
        # Mock response with GraphQL errors
        self.mock_response.status_code = 200
        self.mock_response.json.return_value = {
            "data": None,
            "errors": [
                {"message": "Field not found", "path": ["user", "nonexistent"]},
                {"message": "Another error"}
            ]
        }
        
        with self.assertRaises(GraphQLClientGraphQLMultiError) as context:
            client.get_data(self.mock_response)
        
        # Check that the error contains our error messages
        self.assertIn("Field not found", str(context.exception))
        self.assertIn("Another error", str(context.exception))

    def test_process_variables_none(self):
        """Test _process_variables with None input."""
        client = BaseClient()
        
        variables, files, files_map = client._process_variables(None)
        
        self.assertEqual(variables, {})
        self.assertEqual(files, {})
        self.assertEqual(files_map, {})

    def test_process_variables_empty(self):
        """Test _process_variables with empty dict."""
        client = BaseClient()
        
        variables, files, files_map = client._process_variables({})
        
        self.assertEqual(variables, {})
        self.assertEqual(files, {})
        self.assertEqual(files_map, {})

    def test_convert_dict_with_unset_values(self):
        """Test _convert_dict_to_json_serializable filters UNSET values."""
        client = BaseClient()
        
        input_dict = {
            "keep": "this",
            "remove": UNSET,
            "also_keep": 42
        }
        
        result = client._convert_dict_to_json_serializable(input_dict)
        
        expected = {"keep": "this", "also_keep": 42}
        self.assertEqual(result, expected)

    def test_convert_value_with_base_model(self):
        """Test _convert_value with BaseModel instances."""
        client = BaseClient()
        
        # Create a simple BaseModel subclass
        class TestModel(BaseModel):
            name: str
            age: int
        
        model = TestModel(name="John", age=30)
        result = client._convert_value(model)
        
        # Should convert to dict using model_dump
        expected = {"name": "John", "age": 30}
        self.assertEqual(result, expected)

    def test_convert_value_with_list(self):
        """Test _convert_value with list of values."""
        client = BaseClient()
        
        # Create a list with mixed types including BaseModel
        class TestModel(BaseModel):
            value: str
        
        input_list = [
            "string",
            42,
            TestModel(value="test"),
            ["nested", "list"]
        ]
        
        result = client._convert_value(input_list)
        
        expected = [
            "string",
            42,
            {"value": "test"},
            ["nested", "list"]
        ]
        self.assertEqual(result, expected)

    def test_convert_value_primitive(self):
        """Test _convert_value with primitive values."""
        client = BaseClient()
        
        # Test various primitive types
        self.assertEqual(client._convert_value("string"), "string")
        self.assertEqual(client._convert_value(42), 42)
        self.assertEqual(client._convert_value(True), True)
        self.assertEqual(client._convert_value(None), None)

    def test_get_files_from_variables_no_uploads(self):
        """Test _get_files_from_variables with no Upload objects."""
        client = BaseClient()
        
        variables = {"name": "test", "count": 42}
        
        result_vars, files, files_map = client._get_files_from_variables(variables)
        
        self.assertEqual(result_vars, {"name": "test", "count": 42})
        self.assertEqual(files, {})
        self.assertEqual(files_map, {})

    def test_get_files_from_variables_with_uploads(self):
        """Test _get_files_from_variables with Upload objects."""
        client = BaseClient()
        
        # Create Upload objects
        upload1 = Upload("file1.txt", io.BytesIO(b"content1"), "text/plain")
        upload2 = Upload("file2.txt", io.BytesIO(b"content2"), "text/plain")
        
        variables = {
            "file": upload1,
            "data": {"nested_file": upload2},
            "regular": "value"
        }
        
        result_vars, files, files_map = client._get_files_from_variables(variables)
        
        # Uploads should be replaced with None
        self.assertEqual(result_vars["file"], None)
        self.assertEqual(result_vars["data"]["nested_file"], None)
        self.assertEqual(result_vars["regular"], "value")
        
        # Files should be indexed
        self.assertEqual(len(files), 2)
        self.assertIn("0", files)
        self.assertIn("1", files)
        
        # Files map should track paths
        self.assertEqual(files_map["0"], ["variables.file"])
        self.assertEqual(files_map["1"], ["variables.data.nested_file"])

    def test_get_files_from_variables_duplicate_uploads(self):
        """Test _get_files_from_variables with duplicate Upload objects."""
        client = BaseClient()
        
        # Create same Upload object used in multiple places
        upload = Upload("shared.txt", io.BytesIO(b"content"), "text/plain")
        
        variables = {
            "file1": upload,
            "file2": upload,  # Same object
        }
        
        result_vars, files, files_map = client._get_files_from_variables(variables)
        
        # Both should be None
        self.assertEqual(result_vars["file1"], None)
        self.assertEqual(result_vars["file2"], None)
        
        # Should only have one file entry
        self.assertEqual(len(files), 1)
        self.assertIn("0", files)
        
        # Files map should track both paths
        self.assertEqual(sorted(files_map["0"]), ["variables.file1", "variables.file2"])

    def test_get_files_from_variables_in_list(self):
        """Test _get_files_from_variables with uploads in lists."""
        client = BaseClient()
        
        upload = Upload("file.txt", io.BytesIO(b"content"), "text/plain")
        
        variables = {
            "files": [upload, "not_file", upload]
        }
        
        result_vars, files, files_map = client._get_files_from_variables(variables)
        
        # List should have Nones where uploads were
        self.assertEqual(result_vars["files"], [None, "not_file", None])
        
        # Should have one file with multiple paths
        self.assertEqual(len(files), 1)
        expected_paths = ["variables.files.0", "variables.files.2"]
        self.assertEqual(sorted(files_map["0"]), expected_paths)

    @patch.object(BaseClient, '_get_files_from_variables')
    def test_execute_multipart_request(self, mock_get_files):
        """Test execute method with file uploads (multipart)."""
        client = BaseClient()
        
        # Mock file processing to return files
        upload = Upload("test.txt", io.BytesIO(b"content"), "text/plain")
        mock_get_files.return_value = (
            {"var": "value"},
            {"0": ("test.txt", upload.content, "text/plain")},
            {"0": ["variables.file"]}
        )
        
        # Mock _process_variables to trigger multipart path
        with patch.object(client, '_process_variables') as mock_process:
            mock_process.return_value = (
                {"var": "value"},
                {"0": ("test.txt", upload.content, "text/plain")},
                {"0": ["variables.file"]}
            )
            
            query = "mutation { upload(file: $file) { success } }"
            variables = {"file": upload}
            
            client.execute(query, variables=variables)
            
            # Should call post with multipart data
            self.mock_session.post.assert_called_once()
            call_args = self.mock_session.post.call_args
            
            # Check that it's a multipart request
            self.assertIn("data", call_args[1])
            self.assertIn("files", call_args[1])
            
            # Check the operations data
            operations_data = json.loads(call_args[1]["data"]["operations"])
            self.assertEqual(operations_data["query"], query)
            self.assertEqual(operations_data["variables"], {"var": "value"})

    def test_execute_json_request(self):
        """Test execute method without files (JSON)."""
        client = BaseClient()
        
        query = "query { user { name } }"
        variables = {"id": "123"}
        
        client.execute(query, variables=variables)
        
        # Should make JSON request
        call_args = self.mock_session.post.call_args
        
        # Should not have files parameter
        self.assertNotIn("files", call_args[1])
        
        # Should have JSON data
        self.assertIn("data", call_args[1])
        request_data = json.loads(call_args[1]["data"])
        self.assertEqual(request_data["query"], query)
        self.assertEqual(request_data["variables"], variables)

    def test_base_model_configuration(self):
        """Test BaseModel configuration and behavior."""
        from quilt3._graphql_client.base_model import BaseModel

        # Test that we can create a BaseModel subclass
        class TestModel(BaseModel):
            name: str
            optional_field: str = None
        
        # Test model creation and validation
        model = TestModel(name="test")
        self.assertEqual(model.name, "test")
        self.assertIsNone(model.optional_field)
        
        # Test model_dump functionality
        dumped = model.model_dump()
        self.assertIn("name", dumped)
        
        # Test that the model config allows arbitrary types
        # and has the expected configuration
        config = TestModel.model_config
        self.assertTrue(config.get("populate_by_name", False))
        self.assertTrue(config.get("validate_assignment", False))
        self.assertTrue(config.get("arbitrary_types_allowed", False))

    def test_unset_in_model_fields(self):
        """Test UNSET behavior in model fields."""
        from quilt3._graphql_client.base_model import BaseModel
        
        class TestModel(BaseModel):
            required_field: str
            optional_field: str = UNSET
        
        # Create model with UNSET field
        model = TestModel(required_field="test")
        
        # Should be able to serialize without UNSET fields
        dumped = model.model_dump(exclude_unset=True)
        self.assertEqual(dumped, {"required_field": "test"})

    def test_client_error_edge_cases(self):
        """Test edge cases in error handling."""
        client = BaseClient()
        
        # Test get_data with 299 status (edge of success range)
        self.mock_response.status_code = 299
        self.mock_response.json.return_value = {"data": {"test": "success"}}
        
        # Should still work (299 is in 200-299 range)
        result = client.get_data(self.mock_response)
        self.assertEqual(result, {"test": "success"})
        
        # Test get_data with 300 status (edge of error range)
        self.mock_response.status_code = 300
        
        with self.assertRaises(GraphQLClientHttpError):
            client.get_data(self.mock_response)