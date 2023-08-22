ARG FUNCTION_DIR="/function"

FROM debian:bullseye-20230814-slim@sha256:61386e11b5256efa33823cbfafd668dd651dbce810b24a8fb7b2e32fa7f65a85 as base-image

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

COPY thumbnail/requirements.txt /requirements/thumbnail.txt
RUN pip install -U pip setuptools
RUN pip install --target /deps -r /requirements/thumbnail.txt
RUN curl --output /deps/unoconv \
    https://raw.githubusercontent.com/unoconv/unoconv/be5301a757552f4ecac5d73187ce4d8e18341306/unoconv

COPY shared/ /src/shared/
COPY thumbnail/ /src/thumbnail/
RUN pip install --target /lambda --no-deps /src/shared/ /src/thumbnail/

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
