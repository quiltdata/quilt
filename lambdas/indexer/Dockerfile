ARG FUNCTION_DIR="/function"

FROM public.ecr.aws/lambda/python:3.12.2026.04.22.12@sha256:feda368c524d3c7c728d3f14701701d1444d6d0f04fe0f3dfef0a85d244f60c6 AS base

FROM base AS build

# Include global arg in this stage of the build
ARG FUNCTION_DIR

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /src/lambdas/indexer

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=${FUNCTION_DIR}

COPY py-shared /src/py-shared

RUN --mount=type=cache,target=/root/.cache \
    --mount=type=bind,source=lambdas/indexer/uv.lock,target=/src/lambdas/indexer/uv.lock \
    --mount=type=bind,source=lambdas/indexer/pyproject.toml,target=/src/lambdas/indexer/pyproject.toml \
    uv sync \
    --locked \
    --no-dev \
    --group=prod \
    --no-install-project

COPY . /src
RUN --mount=type=cache,target=/root/.cache \
    uv sync \
    --locked \
    --no-dev \
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
