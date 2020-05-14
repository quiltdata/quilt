# The bare minimum Dockerfile to install aicsimageio==3.0.* and all its dependencies

# Must start from this image for lambda support
FROM amazonlinux:2018.03

# Install python
RUN yum install python36-devel.x86_64 -y
RUN yum install python36-pip.noarch -y

# Get gcc for Cython
RUN yum install gcc.noarch -y

# Set python3.6 to default python3
RUN ln -sf /usr/bin/python3.6 /usr/bin/python3
RUN ln -sf /usr/bin/pip-3.6 /usr/bin/pip3

# Get requirements file
COPY requirements.txt requirements.txt

# Update pip
RUN pip3 install --upgrade pip

# Get Cython for numpy
RUN pip3 install Cython

# Install package
RUN pip3 install -r requirements.txt
