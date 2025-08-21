
test:
	pytest --disable-warnings

install-local:
	pip install -e .[tests]

# Linting targets that mimic CI for our changed files only
lint-deps:
	@python -c "import isort" 2>/dev/null || pip install isort
	@python -c "import pycodestyle" 2>/dev/null || pip install pycodestyle

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
	fi
	@echo "Lint complete!"

lint-all: lint-deps
	@echo "Running lint on all Python files..."
	isort . --quiet
	python -m pycodestyle $$(find . -name '*.py' -not -path './venv/*' -not -path './.venv/*') || true
	@echo "Lint complete!"

.PHONY: test install-local lint-deps lint lint-all
