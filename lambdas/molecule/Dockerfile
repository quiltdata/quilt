ARG FUNCTION_DIR="/function"

FROM python:3.11-slim-bullseye@sha256:3f49624af26072e71410af738fd983f887a7f4b3c8824a9ec5973178511c654d AS base-image

FROM base-image as build-image

# Include global arg in this stage of the build
ARG FUNCTION_DIR
# Create function directory
RUN mkdir -p ${FUNCTION_DIR}

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        libc6-dev

COPY molecule/requirements.txt /requirements/molecule.txt
RUN pip install -U pip setuptools
RUN pip install --target /deps -r /requirements/molecule.txt

COPY shared/ /src/shared/
COPY molecule/ /src/molecule/
RUN pip install --target /lambda --no-deps /src/shared/ /src/molecule/

FROM base-image

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
       openbabel \
    && \
    apt-get clean

# Include global arg in this stage of the build
ARG FUNCTION_DIR
# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

# Copy in the build image dependencies
COPY --from=build-image /deps ${FUNCTION_DIR}
COPY --from=build-image /lambda ${FUNCTION_DIR}

ENTRYPOINT ["/usr/local/bin/python", "-m", "awslambdaric"]
CMD ["t4_lambda_molecule.lambda_handler"]
