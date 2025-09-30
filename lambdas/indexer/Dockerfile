FROM public.ecr.aws/lambda/python:3.11.2025.09.30.00@sha256:4dea8ba95056e38cb2086a4ee58e923a40db94e3b2b883a116416d5a233a0ec9 AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
