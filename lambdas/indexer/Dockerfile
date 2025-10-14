FROM public.ecr.aws/lambda/python:3.11.2025.10.14.03@sha256:d883d9fe1dee61a9ae60b22da824a2bd29129d660f3cbc71482e7e513f78d13c AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
