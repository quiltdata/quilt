FROM amazon/aws-lambda-python:3.8 as base

# Prepare hand-picked Microsoft fonts.
FROM base as fonts_builder
RUN mkdir /fonts
RUN yum -y install unzip
RUN curl -o /quilt_fonts.zip https://quilt-web-public.s3.amazonaws.com/build/quilt-poppler-utils-0.26.5-42.20.amzn1.x86_64_fonts.zip
RUN unzip -d /fonts /quilt_fonts.zip 'fonts/*' -x '*/.DS_Store'

FROM base as pyenv_builder
RUN yum -y install gcc
COPY shared/ /src/shared/
COPY thumbnail/ /src/thumbnail/
RUN pip install -U pip setuptools
RUN pip install --target /env -r /src/shared/requirements.txt /src/shared/ -r /src/thumbnail/requirements.txt /src/thumbnail/

FROM base
ARG LIBREOFFICE_VERSION=7.2.5.1

# Install LibreOffice.
RUN yum -y install tar gzip && \
    mkdir /libreoffice-dist && \
    curl -L https://downloadarchive.documentfoundation.org/libreoffice/old/${LIBREOFFICE_VERSION}/rpm/x86_64/LibreOffice_${LIBREOFFICE_VERSION}_Linux_x86-64_rpm.tar.gz | tar -C /libreoffice-dist -z -x && \
    cd /libreoffice-dist/LibreOffice_${LIBREOFFICE_VERSION}_Linux_x86-64_rpm/RPMS/ && \
    yum install -y  libobasis7.2-{core,en-US,images,impress,ooofonts}-${LIBREOFFICE_VERSION}-*.x86_64.rpm \
                    libreoffice7.2-${LIBREOFFICE_VERSION}-*.x86_64.rpm \
                    libreoffice7.2-{en-US,impress,ure}-${LIBREOFFICE_VERSION}-*.x86_64.rpm \
                    poppler-utils \
                    dbus-libs cups-libs cairo libSM && \
    rm -r /libreoffice-dist && \
    yum clean all

# Install Python environment.
COPY --from=pyenv_builder /env/ $LAMBDA_TASK_ROOT

# Install fonts.
COPY --from=fonts_builder /fonts ${LAMBDA_TASK_ROOT}/quilt_binaries/
ENV FONTCONFIG_FILE=$LAMBDA_TASK_ROOT/quilt_binaries/fonts/fonts.conf

CMD ["index.lambda_handler"]
