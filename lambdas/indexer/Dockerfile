ARG FUNCTION_DIR="/function"

FROM public.ecr.aws/lambda/python:3.13.2026.06.05.14@sha256:536cd2f64c41dede36aa5fcf82dbbfefbef75db178ff4eb631ad0f07bd4e935f AS base

FROM base AS build

# Include global arg in this stage of the build
ARG FUNCTION_DIR

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=${FUNCTION_DIR}

COPY pyproject.toml /src/pyproject.toml
COPY uv.lock /src/uv.lock
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
