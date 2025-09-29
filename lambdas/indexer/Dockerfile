FROM public.ecr.aws/lambda/python:3.11.2025.09.28.12@sha256:0d8990ce4d4e2b273946dc4a029ab90437775614bbb01a13179d301832029e50 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
