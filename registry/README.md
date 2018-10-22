![python 3.5,_3.6](https://img.shields.io/badge/python-3.5,_3.6-blue.svg)

# Quilt Registry
The registry stores package data, meta-data, and controls permissions.

This is the reference implementation of the Quilt server and package registry.
Docker and `docker-compose` are used both in production and for testing and
development.  If you don't have Docker, see the section on 
[Installing docker and docker-compose](#installing-docker-and-docker-compose).

# Testing and Development
The instructions in this section are **for testing purposes only**, and do not
instantiate a persistent database, and do not communicate with blob storage.
For persistent usage, see the section on 
[setting up a production environment](#production).

|**IMPORTANT:** The database is reset (deleted) on each startup/shutdown|
|---|
|It's important to note that this configuration of the registry is stateless. Because both the database and storage system are run in docker containers (without persistent volumes) all package state is reset every time the services are restarted. To configure the database to use persistent storage, set `PGDATA` to point to a Docker volume as described [here](https://hub.docker.com/_/postgres/).|

<!--
In development, it's often useful to leave the database and storage service running (avoiding deletion), and only restart the Flask webserver.  To do this, from the ```registry/``` directory, run ```docker-compose create --force-recreate --build flask``` instead of docker-compose restart/down/up.
-->

## Build and start the containers
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
127.0.0.1    auth s3 flask catalog
```

then run:

```bash
quilt login
```

and follow the instructions provided.  The default login is "admin" and password "quilt".

Note: ```quilt login``` is its own test that the server is working.  You can now run ```quilt build``` and ```quilt push``` to add package(s) to this server, then ```quilt install``` from another machine to install these packages.

### Browse the Quilt catalog in a web browser

To browse the catalog using a web browser, enter this location into your web browser: http://localhost:3000

# Production
|**Warning**: Always use best practices in a production environment|
|---|
|We cannot be familiar with every detail of your production environment.  Always follow best practices when creating a production environment for any public-facing software service, Quilt included.|

This is a quick guide to setting up Quilt for use in a production environment.
In a development environment, everything is preconfigured to provide a quick,
but ephemeral setup.  In production, you'll need to retain your data and provide
a more secure means of usage.  But the tasks that are directly Quilt-related are
fairly straighforward:

* [Configure Quilt](#configure-quilt)
* [Run Quilt](#run-quilt)

However, aside from configuring Quilt itself, your environment will require
further attention.  You'll need:

* A properly-configured reverse proxy or forwarding load balancer to provide SSL
* A Postgres server with the following
  * A database for the registry and catalog to use
  * A user with full rights on that database
* An S3 service provider
  * Amazon is the most thoroughly tested, and is recommended for production
    environments -- however, other S3-compatible providers may work.  We can
    make some accommodations for incompatibilities between S3 providers, so
    if you do run across an issue, please file a bug.
  * S3 may not be your preferred data storage service type.  In that case,
    see instructions on [using minio](#Using Minio) to access other blob
    storage providers.


## Configure Quilt
The following configuration is an example of the basic configuration
requirements for a working setup.  However, a full config example with
comments is available [here](config/example.env), and contains some
settings for cases not directly addressed here.  It is recommended to
copy and modify the [config example](config/example.env) to suit your
production environment.  The name of your config is not important, but
for this example, we'll call it `~/quilt-config.env`.

```
# Quilt-config.env
# QUILT_SECRET_KEY -- choose an arbitrary value
QUILT_SECRET_KEY=flurihozenoskibunskmegnadoskidochi

# QUILT_SERVER_CONFIG -- config loader. Use env_config.py
QUILT_SERVER_CONFIG=env_config.py

#REGISTRY_URL -- Externally and internally accessible address
# Used for client connections
REGISTRY_URL=https://quilt.yourcompany.com:5000

#CATALOG_URL -- Externally and internally accessible address
# Used to provide the web front-end
CATALOG_URL=https://quilt.yourcompany.com

# SQLALCHEMY_DATABASE_URI -- DB URI and credentials
# Use this format:  postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>/<DB_DATABASE>
SQLALCHEMY_DATABASE_URI=postgresql://bob:supersecret@db.yourcompany.com/quilt

## S3 config
# S3_ENDPOINT -- Endpoint for S3
S3_ENDPOINT=s3.us-east-1.amazonaws.com
# PACKAGE_BUCKET -- name of your bucket
PACKAGE_BUCKET_NAME=packages
# AWS_ACCESS_KEY_ID - your public key or identifier
AWS_ACCESS_KEY_ID=MDJJSN24DN825M9
# AWS_SECRET_ACCESS_KEY - your secret key or identifier
AWS_SECRET_ACCESS_KEY=efyPTLHTQp1KuTTpWWveBxmb+Lv+v7mvZw3e7ex

## Mail Settings
# This is required for account registration and similar activities
# Exact details depend on your mail server, so in some cases
# not all of these are required.
QUILT_DEFAULT_SENDER=noreply@quilt.yourcompany.com
SMTP_HOST=smtp.yourcompany.com
SMTP_USERNAME=adam_sandler
SMTP_PASSWORD=zohanftw
SMTP_PORT=25
# Defaults to true
#SMTP_USE_TLS=false
```

## Run Quilt
Quilt exposes only two public ports.  By default, these are port 80
and port 5000, but you can modify these as needed.  Start your Quilt 
server by using `docker-compose`, or by executing docker directly.

#### Using the git repo and docker-compose
This option makes it easy to start, stop, and update the associated
docker images, and provides a cohesive view of their logging output.
```
# Check out the git repostory
git clone https://github.com/quiltdata/quilt
# Change to the quilt registry dir
cd quilt/registry
# Execute the Quilt server with docker-compose
# replace <quilt config> with the path to the quilt config
# you created above
$QUILT_CONFIG=<quilt config> docker-compose -f docker-compose-env.yml up --build
```

#### Calling docker directly
This option provides an easy way to modify the public-facing port, or
to set environment variables temporarily at run-time without modifying
the config.
* You can change the port by modifying the first value in
`80:80` or `5000:80`, for the catalog and registry, respectively.
* Use `docker run`'s `--env NAME=value` to temporarily override a
  specific configuration value.
* Use `docker logs <container>` to view the logs of any of the 
  containers
```
# replace <quilt config> with the path to the config you created.
sudo docker run -d --name catalog --env-file <quilt config> -p 80:80 quiltdata/catalog
sudo docker run --rm --env-file <quilt config> quiltdata/registry flask db upgrade
sudo docker run -d --name registry --env-file <quilt config> -p 5000:80 quiltdata/registry
sudo docker run -d --name registry-nginx --env-file <quilt config> --network container:registry quiltdata/nginx
```

After starting the docker containers with either of the above two methods,
the Quilt server should be listening on the configured ports.  Watch for
errors and misconfiguration messages on container startup.


# Hosting Quilt via Amazon
For hosting on Amazon, create:
* a VPC (or use an existing one)
* an EC2 instance
* a Postgres database -- see [Create a Postres Database in Amazon RDS](https://aws.amazon.com/rds/postgresql/)
* an S3 bucket and access keys (this does not need to be Amazon-based)
* an Elastic Load Balancer (ELB) to terminate SSL connections to the registry (port 5000) and catalog (80)
  * Setting this up to use HTTPS is highly recommended, and very straightforward with the AWS certificate manager.
* a domain name like 'quilt.yourmcompany.com' -- not mandatory, but more clear than Amazon hostnames.

Check to ensure connectivity between the EC2 instance and database. Once 
the resources have been created and connectivity verified, ssh into the EC2
instance and follow instructions for [production](#production).


# Alternate Configurations
### Using an alternative S3-compatible server
Using an S3 compatible service is fairly easy, and just involves setting 
a few variables in `~/env/registry` -- However, S3 implementations may 
vary from provider to provider, and Quilt doesn't currently test services 
other than Amazon.  That said, this is known to work with Google Cloud 
Platform's Cloud Storage.

Simply set the following variables in your Quilt config, using info from
your S3 provider:
```
S3_ENDPOINT=s3.us-east-1.amazonaws.com
PACKAGE_BUCKET_NAME=packages
AWS_ACCESS_KEY_ID=MDJJSN24DN825M9
AWS_SECRET_ACCESS_KEY=efyPTLHTQp1KuTTpWWveBxmb+Lv+v7mvZw3e7ex
```
This is known to work with Google Cloud Platform, but extensive testing
has not been done -- use at your own risk, but feel free to file a bug
report for any issue that come up due to incompatibilities.

### Using Minio
If you want to use a blob storage provider that isn't S3 compatibile,
you'll need to use an S3 Proxy.  Minio is a great project, and quite
easy to use with Quilt:

*Minio, Azure example*
```
docker run -p 9000:9000 --name azure-s3 \
 -e "MINIO_ACCESS_KEY=azurestorageaccountname" \
 -e "MINIO_SECRET_KEY=azurestorageaccountkey" \
 minio/minio gateway azure
```
*Quilt config changes*
```
# must be exposed to quilt clients.
S3_ENDPOINT=https://yourcompany.com:9000
AWS_ACCESS_KEY_ID=azurestorageaccountname  
AWS_SECRET_ACCESS_KEY=azurestorageaccountkey
PACKAGE_BUCKET_NAME=your_azure_bucket
```
Make sure that for production environments, you use an HTTPS
reverse proxy or forwarding load balancer, or follow Minio's
documenation on using TLS.


### Advanced: Headless installation including AWS

Server installations (e.g. AWS) require special instructions because the web browser is not running on the same machine as the Quilt registry.  For this example, let's assume that your server has an external IP address of ```$EXT_IP```

First, modify your ```/etc/hosts``` from this: ```127.0.0.1    auth s3 flask catalog``` to this: ```$EXT_IP   auth s3 flask catalog```.

Second, if your server has a firewall protecting against inbound connections (and most do!), you need to either (a) install and use a text browser such as [lynx](https://lynx.browser.org/) (on Ubuntu: ```apt-get install lynx; lynx http://localhost:5000/login```), (b) disable the firewall temporarily using port-forwarding [instructions for AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.html), or (c) setup an [SSH tunnel](https://www.revsys.com/writings/quicktips/ssh-tunnel.html) so that your laptop browser can connect to your server instance behind its firewall.

### Advanced: GitHub Authentication

You can let users signup/login to your registry using their credentials on GitHub, where their github username (e.g. "asah") is used for their Quilt registry username.

1. Create a new OAuth Application on GitHub ([link](https://github.com/settings/applications/new))
Homepage URL: ```http://localhost:3000```
Authorization callback URL: ```http://flask:5000/oauth_callback```

2. Save your new application's client ID and client secret to the local environment:
```bash
export OAUTH_CLIENT_ID_GITHUB=<OAUTH_APP_CLIENT_ID>
export OAUTH_CLIENT_SECRET_GITHUB=<OAUTH_APP_CLIENT_SECRET>
```

3. Run this command to start the registry and it will automatically use GitHub OAuth for user authentication, instead of its local database:
```bash
docker-compose -f docker-compose-github-auth.yml up
```

Look for this line in the output, which indicates that the server is using github for authentication:
```bash
flask_1       | AUTH_PROVIDER=github
```

4. When users run ```quilt login``` their browser should be redirected to a page on github.com which handles login to the catalog webserver (via cookies/rediects) and also generates the access token for the Quilt client (command-line tools, Python API, etc).

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

        # 1) Quilt auth:
        # Get this one from the stage API app
        # (https://quilt-heroku.herokuapp.com/admin/oauth2_provider/application/3/)
        export OAUTH_CLIENT_SECRET_QUILT=...

        # 2) GitHub auth:
        export AUTH_PROVIDER=github
        # Get this one from the GitHub API app
        # (https://github.com/settings/applications/594774)
        export OAUTH_CLIENT_SECRET_GITHUB=...

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
sudo echo "127.0.0.1 auth s3 flask catalog" | sudo tee -a /etc/hosts
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

## Installing docker and docker-compose
We recommend using `docker-compose` to run a local Quilt registry for testing
and development. This starts a collection of Docker containers to run the
various services needed to run the registry: database, storage, and Flask 
web/API server.  The advantage of Docker is that it isolates you from the 
details of installing each component correctly, including version, 
configuration, etc. -- with docker, everything is pre-configured for you.

### Docker installation for popular operating systems:
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
