
test:
	pytest --disable-warnings

install-local:
	pip install -e .[tests]

# Linting targets that mimic CI for our changed files only
lint-deps:
	@python -c "import isort" 2>/dev/null || pip install isort
	@python -c "import pycodestyle" 2>/dev/null || pip install pycodestyle
	@python -c "import pylint" 2>/dev/null || pip install 'pylint==3.2.7'

# Automatically detect changed Python files vs origin/master (relative to api/python)
CHANGED_FILES = $(shell git diff --name-only HEAD origin/master | grep '^api/python.*\.py$$' | sed 's|^api/python/||' || echo "")

lint: lint-deps
	@echo "Running lint on changed Python files..."
	@if [ -z "$(CHANGED_FILES)" ]; then \
		echo "No changed Python files found."; \
	else \
		echo "Changed files: $(CHANGED_FILES)"; \
		isort $(CHANGED_FILES) --quiet; \
		python -m pycodestyle $(CHANGED_FILES) || true; \
		python -m pylint $(CHANGED_FILES) || true; \
	fi
	@echo "Lint complete!"

lint-all: lint-deps
	@echo "Running lint on all Python files..."
	isort . --quiet
	python -m pycodestyle $$(find . -name '*.py' -not -path './venv/*' -not -path './.venv/*') || true
	python -m pylint . || true
	@echo "Lint complete!"

# GraphQL code generation
graphql-deps:
	@echo "Installing GraphQL dependencies..."
	cd quilt3-graphql && pip install -r requirements.txt

graphql-codegen: graphql-deps
	@echo "Generating GraphQL client code..."
	cd quilt3-graphql && ariadne-codegen

.PHONY: test install-local lint-deps lint lint-all graphql-deps graphql-codegen
