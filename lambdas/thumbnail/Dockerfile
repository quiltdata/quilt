ARG FUNCTION_DIR="/function"

FROM debian:bullseye-20250721-slim@sha256:c2c58af6e3ceeb3ed40adba85d24cfa62b7432091597ada9b76b56a51b62f4c6 as base-image

FROM base-image as build-image

# Include global arg in this stage of the build
ARG FUNCTION_DIR
# Create function directory
RUN mkdir -p ${FUNCTION_DIR}

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        curl \
        python3-dev \
        python3-pip

COPY requirements.txt /requirements/thumbnail.txt
# HACK: Pre-install numpy v1 as a build dependency for tifffile to prevent it from using v2 and failing to build
RUN pip install -U pip setuptools 'numpy<2'
RUN pip install --target /deps -r /requirements/thumbnail.txt
RUN curl --output /deps/unoconv \
    https://raw.githubusercontent.com/unoconv/unoconv/be5301a757552f4ecac5d73187ce4d8e18341306/unoconv

COPY . /src/thumbnail/
RUN pip install --target /lambda --no-deps /src/thumbnail/

FROM base-image

RUN apt-get update && \
    apt-get install -y --no-install-recommends\
        ca-certificates \
        libreoffice-impress-nogui \
        python3 \
        python3-uno \
        poppler-utils \
        fonts-crosextra-caladea \
        fonts-crosextra-carlito \
        fonts-liberation \
        # WebP support
        libfreeimage3 \
    && \
    apt-get clean

# Include global arg in this stage of the build
ARG FUNCTION_DIR
# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

# Copy in the build image dependencies
COPY --from=build-image /deps ${FUNCTION_DIR}
COPY --from=build-image /lambda ${FUNCTION_DIR}

ENTRYPOINT ["/usr/bin/python3", "-m", "awslambdaric"]
CMD ["t4_lambda_thumbnail.lambda_handler"]
