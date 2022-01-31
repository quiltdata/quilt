FROM amazon/aws-lambda-python:3.8 as base

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
RUN yum -y install amazon-linux-extras && \
    # amazon-linux-extras command is broken by the base image.
    python2 -m amazon_linux_extras enable libreoffice && \
    yum -y install libreoffice-impress poppler-utils && \
    yum -y remove amazon-linux-extras && \
    yum clean all

# Install Python environment.
COPY --from=pyenv_builder /deps/ $LAMBDA_TASK_ROOT
COPY --from=pyenv_builder /lambda/ $LAMBDA_TASK_ROOT

CMD ["t4_lambda_thumbnail.lambda_handler"]
