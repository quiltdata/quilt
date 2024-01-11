ARG FUNCTION_DIR="/function"

FROM python:3.8-slim-bullseye@sha256:5f399249dc208063801e3316bcf98b927be8702ca29023317b792b2bc7c52884 AS base-image

FROM base-image as build-image

# Include global arg in this stage of the build
ARG FUNCTION_DIR
# Create function directory
RUN mkdir -p ${FUNCTION_DIR}

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        libc6-dev

COPY pkgpush/requirements.txt /requirements/pkgpush.txt
RUN pip install -U pip setuptools
RUN pip install --target /deps -r /requirements/pkgpush.txt

COPY shared/ /src/shared/
COPY pkgpush/ /src/pkgpush/
RUN pip install --target /lambda --no-deps /src/shared/ /src/pkgpush/

FROM base-image

# Include global arg in this stage of the build
ARG FUNCTION_DIR
# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

# Copy in the build image dependencies
COPY --from=build-image /deps ${FUNCTION_DIR}
COPY --from=build-image /lambda ${FUNCTION_DIR}

ENTRYPOINT ["/usr/local/bin/python", "-m", "awslambdaric"]
CMD ["t4_lambda_pkgpush.lambda_handler"]
