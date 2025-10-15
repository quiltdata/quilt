FROM public.ecr.aws/lambda/python:3.11.2025.10.14.21@sha256:9c079837720965644366e27b4b8e3033d78c6f37d388056a82a1d65e7f9d3780 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
