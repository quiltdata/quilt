FROM public.ecr.aws/lambda/python:3.11.2025.09.24.12@sha256:53a20b41a92d4ce0e1e5967f9bc4e424af3053250d8f1abae6d6814a65af4f46 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
