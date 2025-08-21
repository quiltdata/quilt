
test: install-local
	pytest --disable-warnings

install-local:
	pip install -e .[tests]

# Linting targets that mimic CI for our changed files only
lint-deps:
	@python -m pip install --upgrade isort
	@python -m pip install --upgrade pycodestyle
	@python -m pip install --upgrade pylint

# Automatically detect changed Python files vs master (relative to api/python)
# Exclude GraphQL codegen files from linting
CHANGED_FILES = $(shell git diff --name-only HEAD master | grep '^api/python.*\.py$$' | sed 's|^api/python/||' | grep -v '^quilt3/_graphql_client/' | grep -v '^quilt3/admin/_graphql_client/' || echo "")

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
	python -m pycodestyle $$(find . -name '*.py' -not -path './venv/*' -not -path './.venv/*' -not -path './quilt3/_graphql_client/*') || true
	python -m pylint . --ignore=quilt3/_graphql_client || true
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
gendocs-setup-python:
	@echo "Setting up Python 3.9 for documentation generation (to match CI)..."
	@if ! command -v pyenv >/dev/null 2>&1; then \
		echo "ERROR: pyenv is required for documentation generation to match CI behavior."; \
		echo "Please install pyenv: https://github.com/pyenv/pyenv"; \
		exit 1; \
	fi
	@if ! pyenv versions | grep -q "3.9"; then \
		echo "Installing Python 3.9 via pyenv..."; \
		pyenv install 3.9.23; \
	else \
		echo "Python 3.9 already available via pyenv."; \
	fi

gendocs-deps: gendocs-setup-python
	@echo "Installing documentation generation dependencies with Python 3.9..."
	@PYENV_VERSION=3.9.23 pip install --upgrade pip setuptools
	@PYENV_VERSION=3.9.23 pip install nbconvert git+https://github.com/quiltdata/pydoc-markdown.git@v2.0.5+quilt3.2
	@echo "Installing current quilt3 package for CLI documentation generation..."
	@PYENV_VERSION=3.9.23 pip install -e .

gendocs: gendocs-deps
	@echo "Generating documentation with Python 3.9 to match CI environment..."
	@cd ../../gendocs && PYENV_VERSION=3.9.23 python build.py
	@echo "Documentation generation complete!"
	@echo "Cleaning up any .python-version files that may have been created..."
	@rm -f .python-version ../../gendocs/.python-version

.PHONY: test install-local lint-deps lint lint-all graphql-deps graphql-codegen lint-docs gendocs-setup-python gendocs-deps gendocs
