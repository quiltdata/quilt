
test: install-local
	pytest --disable-warnings

coverage: install-local
	pytest --cov=quilt3 --cov-report=html --cov-report=term --disable-warnings

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
	@echo "Running lint on changed Python files (with auto-fix)..."
	@if [ -z "$(CHANGED_FILES)" ]; then \
		echo "No changed Python files found."; \
	else \
		echo "Changed files: $(CHANGED_FILES)"; \
		isort $(CHANGED_FILES); \
		python -m pycodestyle $(CHANGED_FILES) || true; \
		python -m pylint $(CHANGED_FILES) || true; \
	fi
	@echo "Lint complete!"

lint-all: lint-deps
	@echo "Running lint on all Python files (with auto-fix)..."
	isort .
	python -m pycodestyle $$(find . -name '*.py' -not -path './venv/*' -not -path './.venv/*' -not -path './quilt3/_graphql_client/*') || true
	python -m pylint . --ignore=quilt3/_graphql_client || true
	@echo "Lint complete!"

# Auto-fix variants (local development)
fix-deps:
	@python -m pip install --upgrade isort autopep8

fix: fix-deps
	@echo "Auto-fixing changed Python files..."
	@if [ -z "$(CHANGED_FILES)" ]; then \
		echo "No changed Python files found."; \
	else \
		echo "Changed files: $(CHANGED_FILES)"; \
		isort $(CHANGED_FILES); \
		autopep8 --in-place $(CHANGED_FILES); \
		echo "✓ Import sorting and PEP8 formatting fixed"; \
		echo "Note: pylint issues may require manual fixes"; \
	fi
	@echo "Auto-fix complete!"

fix-all: fix-deps
	@echo "Auto-fixing all Python files..."
	isort .
	autopep8 --in-place --recursive . --exclude=./venv,./quilt3/_graphql_client
	@echo "✓ Import sorting and PEP8 formatting fixed for all files"
	@echo "Note: pylint issues may require manual fixes"
	@echo "Auto-fix complete!"

# Just isort (fastest auto-fix)
sort: lint-deps
	@echo "Auto-fixing import sorting on changed files..."
	@if [ -z "$(CHANGED_FILES)" ]; then \
		echo "No changed Python files found."; \
	else \
		echo "Changed files: $(CHANGED_FILES)"; \
		isort $(CHANGED_FILES); \
		echo "✓ Import sorting fixed"; \
	fi

sort-all: lint-deps  
	@echo "Auto-fixing import sorting on all files..."
	isort .
	@echo "✓ Import sorting fixed for all files"

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

# CI-identical targets using Docker (exact match to GitHub Actions)
lint-ci:
	@echo "Running CI-identical linting (pylint==3.2.7, from repository root like CI)..."
	docker build -f docker/ci-python.Dockerfile -t quilt-ci-lint ../..
	docker run --rm -v $(PWD)/../..:/workspace quilt-ci-lint sh -c "\
		pylint . && \
		pycodestyle \$$(find -name '*.py' -not -path './venv/*' -not -path './catalog/node_modules/*')"

isort-ci:
	@echo "Running CI-identical isort check (--check --diff from repository root like CI)..."
	docker build -f docker/ci-python.Dockerfile -t quilt-ci-lint ../..
	docker run --rm -v $(PWD)/../..:/workspace quilt-ci-lint sh -c "\
		isort --check --diff ."

test-ci:
	@echo "Running CI-identical tests with coverage (from repository root like CI)..."
	docker build -f docker/ci-python.Dockerfile -t quilt-ci-lint ../..
	docker run --rm -v $(PWD)/../..:/workspace quilt-ci-lint sh -c "\
		python -m pip install -e api/python[tests] && \
		pytest --cov=api/python api/python"

gendocs-ci:
	@echo "Running CI-identical documentation generation (Python 3.9)..."
	docker build -f docker/gendocs.Dockerfile -t quilt-gendocs ../..
	docker run --rm -v $(PWD)/../..:/workspace quilt-gendocs sh -c "\
		python -m pip install api/python && \
		cd gendocs && python build.py && \
		git diff --exit-code"

lint-docs-ci:
	@echo "Running CI-identical documentation linting (with memory limit)..."
	docker run --rm -v $(PWD)/../..:/workspace --memory=4g node:latest sh -c "\
		export NODE_OPTIONS='--max-old-space-size=4096' && \
		npx --package=markdownlint-cli markdownlint ."

# Run all CI checks locally
ci-all: lint-ci isort-ci test-ci gendocs-ci lint-docs-ci
	@echo "All CI-identical checks completed!"

# Build Docker images
docker-build:
	@echo "Building CI Docker images..."
	docker build -f docker/ci-python.Dockerfile -t quilt-ci-lint ../..
	docker build -f docker/gendocs.Dockerfile -t quilt-gendocs ../..

.PHONY: test coverage install-local lint-deps lint lint-all fix-deps fix fix-all sort sort-all graphql-deps graphql-codegen lint-docs gendocs-setup-python gendocs-deps gendocs lint-ci isort-ci test-ci gendocs-ci lint-docs-ci ci-all docker-build
