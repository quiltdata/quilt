ARG FUNCTION_DIR="/function"

FROM public.ecr.aws/lambda/python:3.13.2026.04.22.12@sha256:696856dce3cf45961e3c911e30e86657eccaaca1625435d2d58fe1e61594f977 AS base

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
    --no-default-groups \
    --group=prod \
    --no-install-project

COPY . /src
WORKDIR /src
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

COPY --from=build ${FUNCTION_DIR} ${FUNCTION_DIR}

# Configure environment for Lambda runtime
ENV NUMBA_DISABLE_JIT=1 \
    MPLCONFIGDIR=/tmp/matplotlib \
    MPLBACKEND=Agg

ENTRYPOINT ["./bin/python3", "-m", "awslambdaric"]
CMD ["t4_lambda_tabular_preview.lambda_handler"]
