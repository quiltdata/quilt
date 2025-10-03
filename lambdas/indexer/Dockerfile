FROM public.ecr.aws/lambda/python:3.11.2025.10.02.15@sha256:c695d2558d82d462420e7d9bdfd2393a9f5458f0710b97c844d4e3852bc4cffe AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
