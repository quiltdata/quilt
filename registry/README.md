# Overview

This is the reference implementation of the Quilt server and package registry.

## Implementation
* Flask
* MySQL

## Python support
- 3.4
- 3.5
- 3.6

# Get Started
## Install
* Install and start MySQL
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

## Run with Docker

Run a local Quilt registry for testing and development using `docker-compose`. This starts a collection of docker containers to run the various services needed to run the registry: database, storage, and flask. By default, this local registry will use GitHub as its authentication service (OAuth2Provider) <b>see Setting up GitHub Authentication</b> below.

### Set up GitHub Authentication
Create a new OAuth Application on GitHub at:
https://github.com/settings/applications/new

Authorization callback URL: 
http://flask:5000/oauth_callback

Homepage URL:
http://localhost:3000

Save your new application's client ID and client secret to the local environment:
```bash
export OAUTH_CLIENT_ID_GITHUB=<OAUTH_APP_CLIENT_ID>
export OAUTH_CLIENT_SECRET_GITHUB=<OAUTH_APP_CLIENT_SECRET>
```

### Run the registry with docker-compose

    docker-compose up

Tear down the containers by running:

    docker-compose down

Connect to the local registry in the Quilt compiler by setting `QUILT_PKG_URL=http://localhost:5000`

Connect to the local Quilt catalog by pointing your browser to: http://localhost:3000

It's important to note that this configuration of the registry is stateless. Because both the database and storage system are run in docker containers (without persistent volumes) all package stage is reset every time the services are restarted.

In development, it's often useful to leave the database and storage service running, and only restart the flask container.

    docker-compose create --force-recreate --build flask



## DB Migrations
Create a new migrations file:

    flask db migrate -m "[description of your changes]"

Edit the newly-created migrations file, `migrations/versions/[whatever].py`.

Apply the migration:

    flask db upgrade

Don't forget to add it to the repo:

    git add migrations/versions/[whatever].py
