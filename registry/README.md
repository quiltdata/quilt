# Overview

This is the reference implementation of the Quilt server and package registry.

# Running with Docker

We recommend using `docker-compose` to run a local Quilt registry for testing and development. This starts a collection of docker containers to run the various services needed to run the registry: database, storage, and Flask web/API server.  The advantage of docker is that it isolates you from the details of installing each component correctly, including version, configuration, etc. -- with docker, everything is per-configured for you.

## VERY IMPORTANT: Docker database is reset (deleted) on each startup/shutdown!!!

It's important to note that this configuration of the registry is stateless. Because both the database and storage system are run in docker containers (without persistent volumes) all package stage is reset every time the services are restarted.

In development, it's often useful to leave the database and storage service running (avoiding deletion), and only restart the Flask webserver.  To do this, from the ```registry/``` directory, run ```docker-compose create --force-recreate --build flask``` instead of docker-compose restart/down/up.

## Step 1) Install docker docker-compose

Here are some helpful instructions for popular operating systems:

Ubuntu Linux 16.04: [docker](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-16-04)  [docker-compose](https://docs.docker.com/compose/install/)

Other Linux: [docker](https://docs.docker.com/engine/installation/#server)  [docker-compose](https://docs.docker.com/compose/install/#prerequisites)

MacOS: [docker](https://docs.docker.com/docker-for-mac/install/)  [docker-compose](https://docs.docker.com/compose/install/)   Important: do NOT use HomeBrew, which installs an older version that it not compatible.

Windows: (instructions coming soon)


## Step 2) build containers

```bash
cd quilt    # run from the toplevel directory   
docker build -t quiltdata/catalog catalog

cd quilt/registry  # run from the registry subdirectory
docker build -t quiltdata/nginx-s3-proxy nginx-s3
```

Typical expected output:

```bash
~/quilt/quilt$ docker build -t quiltdata/catalog catalog
Sending build context to Docker daemon  2.724MB
Step 1/20 : FROM ubuntu:latest
 ---> 00fd29ccc6f1
Step 2/20 : MAINTAINER Quilt Data, Inc. contact@quiltdata.io
 ---> Using cache
 ---> 201217d44732
...
Step 20/20 : CMD envsubst < config.js.tmpl > /usr/share/nginx/html/config.js && exec nginx -g 'daemon off;'
 ---> Using cache
 ---> c22d3af926a7
Successfully built c22d3af926a7
Successfully tagged quiltdata/catalog:latest
```


## Step 3) start the containers

```bash
docker-compose up
```

Typical expected output:

```bash
~/quilt/quilt/registry$ docker-compose up
registry_s3_1 is up-to-date
registry_db_1 is up-to-date
Recreating aa25b07e0b3c_registry_catalog_1 ...
Recreating aa25b07e0b3c_registry_catalog_1
registry_nginxflask_1 is up-to-date
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

<!--
[//]: # 
[//]: # 
[//]: # # Running directly (not with Docker)
[//]: # 
[//]: # If you are very careful, you can run Quilt directly in your host operating system.
[//]: # 
[//]: # ## Implementation
[//]: # * Flask
[//]: # * Postgres
[//]: # 
[//]: # ## Python support
[//]: # - 3.4
[//]: # - 3.5
[//]: # - 3.6
[//]: # 
[//]: # # Get Started
[//]: # ## Install
[//]: # 
[//]: # * Install and start Postgres
[//]: # * Create a `quilt` database:
[//]: # 
[//]: #         $ mysql -u root  # No password needed - yay MySQL.
[//]: #         > create database quilt;
[//]: # 
[//]: #   * Mac OS X & newer mysql versions: You may need to login to the database and set the root password to `''` to complete the above
[//]: # 
[//]: # * Create a virtual env
[//]: # * Install the server package and its dependencies:
[//]: # 
[//]: #         $ pip install -r requirements.txt
[//]: #         $ pip install -e .
[//]: # 
[//]: # * Add these to the env's `postactivate` script:
[//]: # 
[//]: #         export FLASK_APP=quilt_server
[//]: #         export FLASK_DEBUG=1
[//]: #         export QUILT_SERVER_CONFIG=dev_config.py
[//]: # 
[//]: #         # 1) Quilt auth:
[//]: #         # Get this one from the stage API app
[//]: #         # (https://quilt-heroku.herokuapp.com/admin/oauth2_provider/application/3/)
[//]: #         export OAUTH_CLIENT_SECRET_QUILT=...
[//]: # 
[//]: #         # 2) GitHub auth:
[//]: #         export AUTH_PROVIDER=github
[//]: #         # Get this one from the GitHub API app
[//]: #         # (https://github.com/settings/applications/594774)
[//]: #         export OAUTH_CLIENT_SECRET_GITHUB=...
[//]: # 
[//]: #         # Optional: set a Mixpanel token (for the "Debug" project)
[//]: #         export MIXPANEL_PROJECT_TOKEN=247b6756f3a8616f9369351b0e5e1fe9
[//]: # 
[//]: # * Activate the environment again - make sure the variables got set
[//]: # * Initialize the database tables:
[//]: # 
[//]: #         flask db upgrade
[//]: # * Set up a fake S3 server. Either:
[//]: #     * build a docker image from `nginx-s3/Dockerfile`, and run it with port 5001 exposed, or
[//]: #     * run `nginx` manually and add `nginx-s3/nginx-s3.conf` to the site configs.
[//]: # 
[//]: # ## Run Flask directly
[//]: # 
[//]: #     flask run
[//]: # ## Advanced: DB Migrations
[//]: # 
[//]: # Create a new migrations file:
[//]: # 
[//]: #     flask db migrate -m "[description of your changes]"
[//]: # 
[//]: # Edit the newly-created migrations file, `migrations/versions/[whatever].py`.
[//]: # 
[//]: # Apply the migration:
[//]: # 
[//]: #     flask db upgrade
[//]: # 
[//]: # Don't forget to add it to the repo:
[//]: # 
[//]: #     git add migrations/versions/[whatever].py
-->
