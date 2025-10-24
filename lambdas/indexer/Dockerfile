FROM public.ecr.aws/lambda/python:3.13.2025.10.24.11@sha256:c5e35a293354ee5f4ddd04cd014ce5164d5630bcb027d25a0500941ab3689da9 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
