FROM amazon/aws-lambda-python:3.8
ARG LIBREOFFICE_VERSION=7.2.5.2

    # Install hand-picked Microsoft fonts.
RUN curl -o /quilt_fonts.zip https://quilt-web-public.s3.amazonaws.com/build/quilt-poppler-utils-0.26.5-42.20.amzn1.x86_64_fonts.zip && \
    yum -y install unzip && \
    mkdir ${LAMBDA_TASK_ROOT}/quilt_binaries/ && \
    unzip -d ${LAMBDA_TASK_ROOT}/quilt_binaries/ /quilt_fonts.zip 'fonts/*' -x '*/.DS_Store' && \
    rm /quilt_fonts.zip && \
    yum -y erase unzip && \
    # Install LibreOffice.
    yum -y install tar gzip && \
    mkdir /libreoffice-dist && \
    curl -L https://downloadarchive.documentfoundation.org/libreoffice/old/${LIBREOFFICE_VERSION}/rpm/x86_64/LibreOffice_${LIBREOFFICE_VERSION}_Linux_x86-64_rpm.tar.gz | tar -C /libreoffice-dist -z -x && \
    cd /libreoffice-dist/LibreOffice_${LIBREOFFICE_VERSION}_Linux_x86-64_rpm/RPMS/ && \
    yum install -y  libobasis7.2-{core,en-US,graphicfilter,images,impress,ooofonts}-${LIBREOFFICE_VERSION}-*.x86_64.rpm \
                    libreoffice7.2-${LIBREOFFICE_VERSION}-*.x86_64.rpm \
                    libreoffice7.2-{en-US,impress,ure}-${LIBREOFFICE_VERSION}-*.x86_64.rpm \
                    poppler-utils \
                    dbus-libs cups-libs cairo libSM && \
    rm -r /libreoffice-dist && \
    yum clean all
ENV FONTCONFIG_FILE=$LAMBDA_TASK_ROOT/quilt_binaries/fonts/fonts.conf

# Required for building tifffile.
RUN yum install -y gcc

# Copy function code
COPY shared/ /src/shared/
COPY thumbnail/ /src/thumbnail/
RUN pip install --no-cache-dir -r /src/shared/requirements.txt /src/shared/ -r /src/thumbnail/requirements.txt /src/thumbnail/
#COPY pptx-preview/app.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD ["index.lambda_handler"]
