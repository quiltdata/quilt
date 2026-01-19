ARG FUNCTION_DIR="/function"

FROM debian:trixie@sha256:0d01188e8dd0ac63bf155900fad49279131a876a1ea7fac917c62e87ccb2732d AS base

FROM base AS build

# Include global arg in this stage of the build
ARG FUNCTION_DIR

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        curl \
        python3-dev \
        python3-pip

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

RUN apt-get update && \
    apt-get install -y --no-install-recommends\
        ca-certificates \
        libreoffice-impress-nogui \
        python3 \
        poppler-utils \
        fonts-crosextra-caladea \
        fonts-crosextra-carlito \
        fonts-liberation \
    && \
    apt-get clean

# Include global arg in this stage of the build
ARG FUNCTION_DIR
# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

COPY --from=build ${FUNCTION_DIR} ${FUNCTION_DIR}

ENTRYPOINT ["./bin/python3", "-m", "awslambdaric"]
CMD ["t4_lambda_thumbnail.lambda_handler"]
