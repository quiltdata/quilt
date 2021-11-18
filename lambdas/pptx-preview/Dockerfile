FROM amazon/aws-lambda-python:3.8

RUN yum -y install tar gzip

RUN mkdir /libreoffice-dist && \
    curl -L https://download.documentfoundation.org/libreoffice/stable/7.2.2/rpm/x86_64/LibreOffice_7.2.2_Linux_x86-64_rpm.tar.gz | tar -C /libreoffice-dist -z -x && \
    cd /libreoffice-dist/LibreOffice_7.2.2.2_Linux_x86-64_rpm/RPMS/ && \
    yum install -y  libobasis7.2-core-7.2.2.2-2.x86_64.rpm \
                    libobasis7.2-en-US-7.2.2.2-2.x86_64.rpm \
                    libobasis7.2-graphicfilter-7.2.2.2-2.x86_64.rpm \
                    libobasis7.2-images-7.2.2.2-2.x86_64.rpm \
                    libobasis7.2-impress-7.2.2.2-2.x86_64.rpm \
                    libobasis7.2-ooofonts-7.2.2.2-2.x86_64.rpm \
                    libreoffice7.2-7.2.2.2-2.x86_64.rpm \
                    libreoffice7.2-en-US-7.2.2.2-2.x86_64.rpm \
                    libreoffice7.2-impress-7.2.2.2-2.x86_64.rpm \
                    libreoffice7.2-ure-7.2.2.2-2.x86_64.rpm \
                    dbus-libs cups-libs cairo libSM && \
    rm -r /libreoffice-dist && \
    yum clean all

# Copy function code
COPY app.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "app.lambda_handler" ]