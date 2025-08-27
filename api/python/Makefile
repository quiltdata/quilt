
test: install-local
	pytest --disable-warnings

coverage: install-local
	pytest --cov=quilt3 --cov-report=html --cov-report=term --disable-warnings

install-local:
	pip install -e .[tests]



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

# Primary development targets (CI-identical using Docker)
lint:
	@echo "Running linting (pylint==3.2.7, from repository root like CI)..."
	docker build -f docker/ci-python.Dockerfile -t quilt-ci-lint ../..
	docker run --rm -v $(PWD)/../..:/workspace quilt-ci-lint sh -c "\
		pylint . && \
		pycodestyle \$$(find -name '*.py' -not -path './venv/*' -not -path './catalog/node_modules/*')"

isort-check:
	@echo "Running import sorting check (--check --diff from repository root like CI)..."
	docker build -f docker/ci-python.Dockerfile -t quilt-ci-lint ../..
	docker run --rm -v $(PWD)/../..:/workspace quilt-ci-lint sh -c "\
		isort --check --diff ."

test-full:
	@echo "Running tests with coverage (from repository root like CI)..."
	docker build -f docker/ci-python.Dockerfile -t quilt-ci-lint ../..
	docker run --rm -v $(PWD)/../..:/workspace quilt-ci-lint sh -c "\
		python -m pip install -e api/python[tests] && \
		pytest --cov=api/python api/python"

# Run all CI checks locally
ci-all: lint isort-check test-full
	@echo "All CI-identical checks completed!"

# Build Docker images
docker-build:
	@echo "Building CI Docker images..."
	docker build -f docker/ci-python.Dockerfile -t quilt-ci-lint ../..
	docker build -f docker/gendocs.Dockerfile -t quilt-gendocs ../..

.PHONY: test coverage install-local graphql-deps graphql-codegen lint-docs gendocs-setup-python gendocs-deps gendocs lint isort-check test-full ci-all docker-build
