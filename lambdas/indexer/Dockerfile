FROM public.ecr.aws/lambda/python:3.11@sha256:759fbc2f7568156874aa6eb0ddce083a242f78104927edfb17e7f3fcd3caf420 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
