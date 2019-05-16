FROM ubuntu:16.04
MAINTAINER Quilt Data, Inc. contact@quiltdata.io

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

RUN apt-get update && apt-get install -y \
    curl \
    gettext \
    libssl-dev \
    build-essential \
    libpng-dev
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs

EXPOSE 3000

RUN mkdir /opt/app
WORKDIR /opt/app

# Install dependencies
COPY package.json .
COPY internals internals
RUN npm install

# Install the app
COPY . .
COPY config.json.example static/config.json
COPY federation.json.example static/federation.json
RUN npm run build:dll
CMD npm start
