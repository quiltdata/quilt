ARG base_image="python:3.7-slim-bullseye"
ARG FUNCTION_DIR="/function"

FROM ${base_image} as build-image

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

FROM ${base_image}

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
