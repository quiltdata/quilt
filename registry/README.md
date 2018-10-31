![python 3.5,_3.6](https://img.shields.io/badge/python-3.5,_3.6-blue.svg)

# Quilt Registry
The registry stores package data, meta-data, and controls permissions.

This is the reference implementation of the Quilt server and package registry.

The instructions below are **for testing purposes only**, as `docker-compose` does not instantiate a persistent database, and does not communicate with blob storage.

# Quickstart with Docker and docker-compose

We recommend using `docker-compose` to run a local Quilt registry for testing and development. This starts a collection of Docker containers to run the various services needed to run the registry: database, storage, and Flask web/API server.  The advantage of Docker is that it isolates you from the details of installing each component correctly, including version, configuration, etc. -- with docker, everything is pre-configured for you.

## IMPORTANT: The database is reset (deleted) on each startup/shutdown

It's important to note that this configuration of the registry is stateless. Because both the database and storage system are run in docker containers (without persistent volumes) all package state is reset every time the services are restarted. To configure the database to use persistent storage, set `PGDATA` to point to a Docker volume as described [here](https://hub.docker.com/_/postgres/).

<!--
In development, it's often useful to leave the database and storage service running (avoiding deletion), and only restart the Flask webserver.  To do this, from the ```registry/``` directory, run ```docker-compose create --force-recreate --build flask``` instead of docker-compose restart/down/up.
-->
## 1. Install docker and docker-compose

Instructions for popular operating systems:

* Ubuntu Linux 16.04
    * [docker](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-16-04)
    * [docker-compose](https://docs.docker.com/compose/install/)
* Other Linux
    * [docker](https://docs.docker.com/engine/installation/#server)
    * [docker-compose](https://docs.docker.com/compose/install/#prerequisites)
* MacOS
    * Do not use Homebrew, which installs an older and incompatible version
    * [docker](https://docs.docker.com/docker-for-mac/install/)
    * [docker-compose](https://docs.docker.com/compose/install/)
* Windows
     * [docker](https://docs.docker.com/docker-for-windows/install/)
     * [docker compose](https://docs.docker.com/compose/install/#install-compose)
     * Make sure you run both PowerShell and Docker for Windows as administrator.


##  2) Build and start the containers
```bash
docker-compose up
```

Typical expected output:

```bash
~/quilt/quilt/registry$ docker-compose up
Creating network "registry_default" with the default driver
Building flask
Step 1/20 : FROM ubuntu:latest
 ---> 0ef2e08ed3fa
Step 2/20 : MAINTAINER Quilt Data, Inc. contact@quiltdata.io
 ---> Running in 132b216161ce
 ---> 283c1c4f43c9
...
Starting registry_flaskmigration_1 ...
Starting registry_flaskmigration_1
registry_flask_1 is up-to-date
registry_auth_1 is up-to-date
Starting registry_djangomigration_1 ...
Starting registry_djangomigration_1
Recreating aa25b07e0b3c_registry_catalog_1 ... done
Attaching to registry_s3_1, registry_db_1, registry_nginxflask_1, registry_flask_1, registry_auth_1, registry_django_1, registry_djangomigration_1, registry_flaskmigration_1, registry_catalog_1
flask_1            | [uWSGI] getting INI configuration from /etc/uwsgi.ini
flask_1            | *** Starting uWSGI 2.0.15 (64bit) on [Mon Jan  8 19:31:46 2018] ***
flask_1            | compiled with version: 5.4.0 20160609 on 08 January 2018 17:19:07
flask_1            | os: Linux-4.9.49-moby #1 SMP Fri Dec 8 13:40:02 UTC 2017
...
djangomigration_1  | Synchronizing apps without migrations:
djangomigration_1  |   Creating tables...
djangomigration_1  |     Running deferred SQL...
djangomigration_1  |   Installing custom SQL...
djangomigration_1  | Running migrations:
djangomigration_1  |   No migrations to apply.
registry_djangomigration_1 exited with code 0
```

note: docker-compose "hangs" (does not terminate) intentionally.  This indicates that the servers are running, and if you kill this process (e.g. Ctrl-C) then it will terminate the Quilt servers.  You can also issue ```docker-compose down``` from another terminal window or if you are running docker-compose as a background process.

### Configure your Quilt client to use your registry

Configure your Quilt client to use this registry (```http://localhost:5000```) instead of the public registry:

```bash
pip install quilt
quilt config
Please enter the URL for your custom Quilt registry (ask your administrator),
or leave this line blank to use the default registry: http://localhost:5000
```

### Login to your registry server

Run:

```bash
sudo vi /etc/hosts
```

and add this line:

```bash
127.0.0.1    s3 flask catalog
```

then run:

```bash
quilt login
```

and follow the instructions provided.  The default login is "admin" and password "quilt".

Note: ```quilt login``` is its own test that the server is working.  You can now run ```quilt build``` and ```quilt push``` to add package(s) to this server, then ```quilt install``` from another machine to install these packages.

### Browse the Quilt catalog in a web browser

To browse the catalog using a web browser, enter this location into your web browser: http://localhost:3000

# Run a Private Registry in AWS

## AWS Resources
Running a Quilt Registry in AWS requires the following services:
* a Postgres database. You can find instructions for setting up Postgres in RDS here: [Create a Postres Database in RDS](https://aws.amazon.com/rds/postgresql/)
* an S3 bucket
* an EC2 instance to run the registry and catalog. Add the following policies to the security group: Postgres, HTTP/HTTPS, SSH and a custom TCP rule to enable port 5000.
* an Elastic Load Balancer (ELB) to terminate SSL connections to the registry and catalog

Once the resources have been created, ssh into the EC2 instance and configure the environment and run the services via Docker. You can make it easier to connect to your registry by creating a new DNS record to point to the EC2 instance's external IP address (e.g., quilt.yourdomain.com).

```bash
ssh ec2-user@quilt.yourdomain.com
mkdir env
sudo yum install docker
sudo service docker start
```

## Configure your environment
Edit the file env/registry and enter the following lines:
```
AWS_ACCESS_KEY_ID=<YOUR_CREDENTIALS_HERE>
AWS_SECRET_ACCESS_KEY=<YOUR_CREDENTIALS_HERE>
QUILT_SERVER_CONFIG=prod_config.py
ALLOW_INSECURE_CATALOG_ACCESS=True
# Find your database credentials in the RDS console
SQLALCHEMY_DATABASE_URI=postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>/<DB_DATABASE>
CATALOG_URL=http://quilt.yourdomain.com
QUILT_SECRET_KEY=<PICK_A_SECRET_KEY>
# Email configuration
QUILT_DEFAULT_SENDER=<DEFAULT_FROM_EMAIL_ADDRESS>
SMTP_HOST=<SMTP_HOST>
SMTP_USERNAME=<YOUR_CREDENTIALS_HERE>
SMTP_PASSWORD=<YOUR_CREDENTIALS_HERE>
S3_HOST=s3
REGISTRY_URL=http://${REGISTRY_HOST}:5000
STRIPE_KEY=NOSTRIPE
UWSGI_HOST=localhost
UWSGI_PORT=9000
NGINX_PORT=80
```

## Run the catalog
```bash
sudo docker run -d --name catalog --env-file ~/env/catalog -p 80:80 quiltdata/catalog
```

## Run the registry
Initialize the database tables by running migrations.
```bash
sudo docker run --rm --env-file ~/env/registry quiltdata/registry flask db upgrade
```

After the migrations are complete, run the registry as follows:
```bash 
sudo docker run -d --name registry --env-file ~/env/registry -p 5000:80 quiltdata/registry
sudo docker run -d -e UWSGI_HOST=localhost -e UWSGI_PORT=9000 -e NGINX_PORT=80 -v /home/ec2-user/nginx-quilt.conf:/etc/nginx/nginx-quilt.template --name registry-nginx --network container:registry nginx /bin/bash -c "envsubst < /etc/nginx/nginx-quilt.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
```

# Advanced Use

### Advanced: Headless installation including AWS

Server installations (e.g. AWS) require special instructions because the web browser is not running on the same machine as the Quilt registry.  For this example, let's assume that your server has an external IP address of ```$EXT_IP```

First, modify your ```/etc/hosts``` from this: ```127.0.0.1    s3 flask catalog``` to this: ```$EXT_IP   s3 flask catalog```.

Second, if your server has a firewall protecting against inbound connections (and most do!), you need to either (a) install and use a text browser such as [lynx](https://lynx.browser.org/) (on Ubuntu: ```apt-get install lynx; lynx http://localhost:5000/login```), (b) disable the firewall temporarily using port-forwarding [instructions for AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.html), or (c) setup an [SSH tunnel](https://www.revsys.com/writings/quicktips/ssh-tunnel.html) so that your laptop browser can connect to your server instance behind its firewall.

### Advanced: Modifying Components

Developers who make changes to source code in the registry, catalog or s3 proxy can follow these steps:
```bash
docker-compose down
```
Edit source code.
```
docker-compose up
```
Docker should rebuild any containers that need updating. To build them manually, follow these commands:

```bash
docker build -t quiltdata/catalog ../catalog
docker build -t quiltdata/nginx-s3-proxy nginx-s3
docker build -t quiltdata/flask .
```

### Advanced: using Teams user endpoints

To use the Teams user endoints, make sure the environment variable ENABLE_USER_ENDPOINTS is set.

<!--
# Running directly (not with Docker)

If you are very careful, you can run Quilt directly in your host operating system.

## Implementation
* Flask
* Postgres

## Python support
- 3.5
- 3.6

# Get Started
## Install

* Install and start Postgres
* Create a `quilt` database:

        $ mysql -u root  # No password needed - yay MySQL.
        > create database quilt;

  * Mac OS X & newer mysql versions: You may need to login to the database and set the root password to `''` to complete the above

* Create a virtual env
* Install the server package and its dependencies:

        $ pip install -r requirements.txt
        $ pip install -e .

* Add these to the env's `postactivate` script:

        export FLASK_APP=quilt_server
        export FLASK_DEBUG=1
        export QUILT_SERVER_CONFIG=dev_config.py

        # Optional: set a Mixpanel token (for the "Debug" project)
        export MIXPANEL_PROJECT_TOKEN=247b6756f3a8616f9369351b0e5e1fe9

* Activate the environment again - make sure the variables got set
* Initialize the database tables:

        flask db upgrade
* Set up a fake S3 server. Either:
    * build a docker image from `nginx-s3/Dockerfile`, and run it with port 5001 exposed, or
    * run `nginx` manually and add `nginx-s3/nginx-s3.conf` to the site configs.

## Run Flask directly

    flask run
## Advanced: DB Migrations

Create a new migrations file:

    flask db migrate -m "[description of your changes]"

Edit the newly-created migrations file, `migrations/versions/[whatever].py`.

Apply the migration:

    flask db upgrade

Don't forget to add it to the repo:

    git add migrations/versions/[whatever].py
-->

# Instructions to set up development environment on Ubuntu Server 16.04.3

1) set up Ubuntu, python and virtualenv
``` bash
apt update
apt upgrade -y
apt install -y python3 python3-pip python3-venv virtualenvwrapper
source `find /usr -name virtualenvwrapper.sh|head -1`
mkvirtualenv -p $(which python3) quilt
export ENV=~/.virtualenvs/quilt
/bin/rm -f $ENV/bin/postactivate; touch $ENV/bin/postactivate
echo 'export WORKON_HOME=$HOME/.virtualenvs' >> $ENV/bin/postactivate
echo 'export PROJECT_HOME=$HOME/projects' >> $ENV/bin/postactivate
echo 'source `find /usr -name virtualenvwrapper.sh|head -1`'  >> $ENV/bin/postactivate # diff versions put it in diff places
```

2) enter the virtual environment
``` bash
workon quilt
pip install --upgrade pip   # ok if it says “requirement already met”
```

3) clone the quilt repo
``` bash
git clone http://github.com/quiltdata/quilt
cd quilt/registry
git checkout team_crud # not once merged
pip install -r requirements.txt
pip install -e .
```

4) install docker and docker-compose from the existing readme:
https://github.com/quiltdata/quilt/blob/master/registry/README.md
NOTE: do not run docker-compose up!  Just install docker and docker-compose
these are the commands for Ubuntu 16.04
``` bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt-get update
sudo apt-get install docker-ce -y

sudo curl -L https://github.com/docker/compose/releases/download/1.18.0/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```
3) build and start docker images -- NOTE: this should appear to hang!  And end with something like this:
djangomigration_1  |   Applying sessions.0001_initial... OK
registry_djangomigration_1 exited with code 0
``` bash
sudo docker-compose -f docker-compose-dev.yml up
```
4) start the flask server  (NEW TERMINAL WINDOW)
``` bash
workon quilt
cd quilt/registry
sudo echo "127.0.0.1 s3 flask catalog" | sudo tee -a /etc/hosts
source quilt_server/flask_dev.sh
```

5) configure client  (NEW TERMINAL WINDOW)
```
workon quilt
cd quilt/compiler
pip install -e .
quilt config
# -- set registry to http://localhost:5000
```

6) attempt to log in
You need to make the ports for Flask and Django accessible to your browser. If you're running docker and flask on a machine with a browser, you can just use that.
Options: lynx, ssh tunnel (ssh -L 5000:localhost:5000 -L 5002:localhost:5002 -L 3000:localhost:3000 user@remote_host)
``` bash
quilt login
```
