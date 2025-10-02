FROM public.ecr.aws/lambda/python:3.11.2025.10.01.20@sha256:dfdda50c4407eee7ad523a931e480583a5b37a6479fc0cbabccd32275bd40ec6 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
