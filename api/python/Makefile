
# Development commands using UV
install:
	uv sync

test:
	uv run pytest --disable-warnings

test-verbose:
	uv run pytest -v

test-coverage:
	uv run pytest --cov=quilt3 --cov-report=term-missing

lint:
	uv run pylint quilt3
	uv run pycodestyle $$(find quilt3 -name '*.py' -not -path 'quilt3/admin/_graphql_client/*')

format-check:
	uv run isort --check --diff .

build:
	uv build

clean:
	rm -rf build dist *.egg-info .pytest_cache .coverage
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# Legacy commands for backward compatibility
install-local:
	@echo "Note: Use 'make install' instead for UV-based installation"
	uv sync
