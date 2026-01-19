ARG FUNCTION_DIR="/function"

FROM public.ecr.aws/lambda/python:3.13.2025.12.18.13@sha256:787dc4ac965c72e74ecdc25ec16917b654239db1a655b8a5f1f24e495e2e4d18 AS base

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

COPY --from=build ${FUNCTION_DIR} ${FUNCTION_DIR}

# Configure environment for Lambda runtime
ENV NUMBA_DISABLE_JIT=1 \
    MPLCONFIGDIR=/tmp/matplotlib \
    MPLBACKEND=Agg

ENTRYPOINT ["./bin/python3", "-m", "awslambdaric"]
CMD ["t4_lambda_tabular_preview.lambda_handler"]
