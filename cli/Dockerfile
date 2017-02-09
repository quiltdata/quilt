FROM continuumio/anaconda3:latest
MAINTAINER Quilt Data, Inc. contact@quiltdata.io


RUN apt-get install -y libssl-dev
RUN useradd -s /bin/bash -m quilt

USER quilt
WORKDIR /home/quilt

# Install Quilt CLI
ARG GITHUB_USER
ARG GITHUB_PASSWORD

RUN conda create -n quiltcli python=3.5 anaconda
ENV PATH="/home/quilt/.conda/envs/quiltcli/bin/:${PATH}"
RUN pip install git+https://$GITHUB_USER:$GITHUB_PASSWORD@github.com/quiltdata/quilt-cli.git@test-data

RUN python -m quilt.test.gen_data -n 5 testpkg
