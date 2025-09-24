FROM public.ecr.aws/lambda/python:3.11.2025.07.03.11@sha256:90a552bb30fd493ed9177e3c1b7e96088925c490938446edc1e81ce8ad110338 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
