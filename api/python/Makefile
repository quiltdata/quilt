
test:
	pytest --disable-warnings

install-local:
	pip install -e .[tests]

# Linting targets that mimic CI for our changed files only
lint-deps:
	@python -c "import isort" 2>/dev/null || pip install isort
	@python -c "import pycodestyle" 2>/dev/null || pip install pycodestyle
	@python -c "import pylint" 2>/dev/null || pip install 'pylint==3.2.7'

# Automatically detect changed Python files vs master (relative to api/python)
CHANGED_FILES = $(shell git diff --name-only HEAD master | grep '^api/python.*\.py$$' | sed 's|^api/python/||' || echo "")

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

# Documentation linting that mirrors CI lint-docs job
lint-docs:
	@echo "Running markdownlint on documentation..."
	@cd ../.. && npx --package=markdownlint-cli markdownlint .
	@echo "Documentation lint complete!"

# Documentation generation that mirrors CI test-gendocs job
gendocs-deps:
	@echo "Installing documentation generation dependencies..."
	pip install nbconvert git+https://github.com/quiltdata/pydoc-markdown.git@v2.0.5+quilt3.2

gendocs: gendocs-deps
	@echo "Generating documentation..."
	cd ../../gendocs && python build.py
	@echo "Documentation generation complete!"

.PHONY: test install-local lint-deps lint lint-all graphql-deps graphql-codegen lint-docs gendocs-deps gendocs
