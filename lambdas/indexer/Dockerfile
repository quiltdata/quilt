ARG FUNCTION_DIR="/function"

FROM public.ecr.aws/lambda/python:3.12.2026.05.15.16@sha256:b99243014011488d98c25b4a556d1503fe37c08b236d41bc7e4a020c20746f8c AS base

FROM base AS build

# Include global arg in this stage of the build
ARG FUNCTION_DIR

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=${FUNCTION_DIR}

COPY py-shared /src/py-shared
COPY lambdas/shared /src/lambdas/shared
COPY lambdas/indexer /src/lambdas/indexer
WORKDIR /src/lambdas/indexer
RUN --mount=type=cache,target=/root/.cache \
    uv sync \
    --locked \
    --no-dev \
    --no-default-groups \
    --group=prod \
    --no-editable

FROM base

# Include global arg in this stage of the build
ARG FUNCTION_DIR
# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

COPY --from=build --chown=app:app ${FUNCTION_DIR} ${FUNCTION_DIR}

ENTRYPOINT ["./bin/python3", "-m", "awslambdaric"]
CMD ["t4_lambda_es_indexer.index.handler"]
