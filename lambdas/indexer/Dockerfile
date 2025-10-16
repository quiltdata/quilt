FROM public.ecr.aws/lambda/python:3.11.2025.09.23.13@sha256:283f21edbe42f9f1c3f42b2a7830ab514bd2b93d35ab8b0525113e82aa3c3285 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
