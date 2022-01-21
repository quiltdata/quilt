FROM amazon/aws-lambda-python:3.8 as base

# Prepare hand-picked Microsoft fonts.
FROM base as fonts_builder
RUN mkdir /fonts
RUN yum -y install unzip
RUN curl -o /quilt_fonts.zip https://quilt-web-public.s3.amazonaws.com/build/quilt-poppler-utils-0.26.5-42.20.amzn1.x86_64_fonts.zip
RUN unzip -d /fonts /quilt_fonts.zip 'fonts/*' -x '*/.DS_Store'

FROM base as pyenv_builder
RUN yum -y install gcc
COPY shared/requirements.txt /requirements/shared.txt
COPY thumbnail/requirements.txt /requirements/thumbnail.txt

RUN pip install -U pip setuptools
RUN pip install --target /deps -r /requirements/shared.txt -r /requirements/thumbnail.txt

COPY shared/ /src/shared/
COPY thumbnail/ /src/thumbnail/
RUN pip install --target /lambda --no-deps /src/shared/ /src/thumbnail/

FROM base
ARG LIBREOFFICE_VERSION=7.2.5.1

# Install fonts.
COPY --from=fonts_builder /fonts ${LAMBDA_TASK_ROOT}/quilt_binaries/
ENV FONTCONFIG_FILE=$LAMBDA_TASK_ROOT/quilt_binaries/fonts/fonts.conf

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
    ln -s /opt/libreoffice7.2/program/soffice /usr/bin/ && \
    rm -r /libreoffice-dist && \
    yum clean all

# Install Python environment.
COPY --from=pyenv_builder /deps/ $LAMBDA_TASK_ROOT
COPY --from=pyenv_builder /lambda/ $LAMBDA_TASK_ROOT

CMD ["index.lambda_handler"]
