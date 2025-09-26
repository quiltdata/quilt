FROM public.ecr.aws/lambda/python:3.11.2025.09.25.20@sha256:da390171e4d5d8712f7f83e5c247a7d205cc3b7144077c270f8a6f5e8512be20 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
