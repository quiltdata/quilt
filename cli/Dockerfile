FROM continuumio/anaconda3:latest
MAINTAINER Quilt Data, Inc. contact@quiltdata.io


RUN apt-get install -y libssl-dev
RUN useradd -s /bin/bash -m quilt

USER quilt
WORKDIR /home/quilt

# Install Quilt CLI
RUN conda create -n quiltcli python=3.5 anaconda
ENV PATH="/home/quilt/.conda/envs/quiltcli/bin/:${PATH}"
RUN pip install quilt

# Copy dummy auth token
RUN mkdir -p /home/quilt/.local/share/QuiltCli/
COPY auth.json /home/quilt/.local/share/QuiltCli/

# Copy gen_data script and build test inputs
COPY gen_data.py /home/quilt
RUN python gen_data.py -n 5 testpkg

# Copy integration test script
COPY integration_test.sh /home/quilt/

