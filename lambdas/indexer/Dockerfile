ARG FUNCTION_DIR="/function"

FROM public.ecr.aws/lambda/python:3.12.2025.10.27.11@sha256:503e2bbd691d900f44b965b4accb589fb3cf3e331cc8d091ca56bc0fc6e2afd3 AS base

FROM base AS build

# Include global arg in this stage of the build
ARG FUNCTION_DIR

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=${FUNCTION_DIR}

RUN --mount=type=cache,target=/root/.cache \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync \
    --locked \
    --no-dev \
    --group=prod \
    --no-install-project

COPY . /src
WORKDIR /src
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
