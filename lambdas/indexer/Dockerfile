FROM public.ecr.aws/lambda/python:3.11.2025.10.12.13@sha256:904593aa9120608ace198a968775ed88149566a890df045f4447d0a0988b717f AS base

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . /src
WORKDIR /src
RUN uv pip install --target /target -r ./requirements.txt .

FROM base
COPY --from=build /target ${LAMBDA_TASK_ROOT}

CMD [ "index.handler" ]
