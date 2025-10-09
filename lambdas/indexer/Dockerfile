FROM public.ecr.aws/lambda/python:3.11.2025.10.05.12@sha256:10034b88d5b542412e81b57f8b93a98c071151cd2034896580dcde4beb9fae1c AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
