FROM public.ecr.aws/lambda/python:3.13@sha256:8a7e192732832465cb613ab8bbcc8c7b8c926f781947cae2963bc97db507c2de AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
