FROM public.ecr.aws/lambda/python:3.11.2025.09.30.13@sha256:f5834eb25b084b31dcc5f91b298af2f74457468b548c602d9c28c869a488c3c3 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
