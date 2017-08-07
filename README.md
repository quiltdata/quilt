# Overview
Quilt is a data package manager. Quilt consists of of two components:
1. A server-side registry (this repository)
    - Controls permissions
    - Manages locations of objects in blob storage
    - Stores package meta-data
    - De-duplicates repeated data fragments
    
2. A [client-side packager](https://github.com/quiltdata/quilt)
    - Serializes tabular data to Apache Parquet
    - `build`s packages locally
    - `push`es packages to the registry
    - `pull`s packages from the registry
    
For more on the design goals of Quilt, visit [docs.quiltdata.com](https://docs.quiltdata.com/).

## Implementationn
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

        $ pip install -e .

* Add these to the env's `postactivate` script:

        export FLASK_APP=quilt_server
        export FLASK_DEBUG=1
        export QUILT_SERVER_CONFIG=dev_config.py

        # Get this one from the stage API app
        # (https://quilt-heroku.herokuapp.com/admin/oauth2_provider/application/3/)
        export OAUTH_CLIENT_SECRET=...

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

## Run the Docker container

    TODO

## DB Migrations
Create a new migrations file:

    flask db migrate -m "[description of your changes]"

Edit the newly-created migrations file, `migrations/versions/[whatever].py`.

Apply the migration:

    flask db upgrade

Don't forget to add it to the repo:

    git add migrations/versions/[whatever].py
