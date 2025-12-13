.PHONY: help build test test-unit test-docker clean verify

# Configuration
# From tests/data, Lambda root is ../..
LAMBDA_DIR := ../..
IMAGE_NAME := tabular-preview:test
CONTAINER_NAME := tabular-preview-test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the Docker image
	@echo "Building Docker image: $(IMAGE_NAME)"
	cd $(LAMBDA_DIR) && docker build -t $(IMAGE_NAME) .

test: build test-unit ## Build and run unit tests

test-unit: ## Run unit tests only (no Docker)
	@echo "Running unit tests..."
	cd $(LAMBDA_DIR) && pytest tests/test_index.py::test_preview_h5ad -v

test-docker: build ## Build and test Docker container
	@./verify-h5ad-docker.py --no-build

verify: ## Run full verification (build + Docker test + unit tests)
	@./verify-h5ad-docker.py

verify-quick: ## Run unit tests only (fastest)
	@./verify-h5ad-docker.py --unit-tests-only

clean: ## Stop container and remove Docker image
	@echo "Cleaning up..."
	-docker stop $(CONTAINER_NAME) 2>/dev/null || true
	-docker rm $(CONTAINER_NAME) 2>/dev/null || true
	-docker rmi $(IMAGE_NAME) 2>/dev/null || true
	@echo "Cleanup complete"

install-deps: ## Install Python dependencies for local testing
	@echo "Installing dependencies..."
	pip install -e ".[test]"

shell: build ## Start a shell in the Docker container
	docker run --rm -it --entrypoint /bin/bash $(IMAGE_NAME)

logs: ## Show logs from running container
	docker logs -f $(CONTAINER_NAME)

start: build ## Start the container in the background
	@echo "Starting container: $(CONTAINER_NAME)"
	-docker rm -f $(CONTAINER_NAME) 2>/dev/null || true
	docker run --rm --name $(CONTAINER_NAME) -d -p 9000:8080 $(IMAGE_NAME)
	@echo "Container started at http://localhost:9000"
	@echo "Use 'make logs' to view logs"
	@echo "Use 'make stop' to stop the container"

stop: ## Stop the running container
	-docker stop $(CONTAINER_NAME) 2>/dev/null || true
	@echo "Container stopped"

invoke: ## Invoke the Lambda with a test payload
	@echo "Invoking Lambda..."
	curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
		-d '{"url": "s3://test-bucket/test.h5ad", "input": "h5ad", "size": "small"}' | jq .

# Development workflow targets

dev: build start ## Start development environment (build + start container)

dev-test: test-unit ## Run unit tests in development mode

rebuild: clean build ## Clean and rebuild from scratch
