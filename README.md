# Quilt Server

## Install
* Install and start MySQL
* Create a `quilt` database:

        $ mysql -u root  # No password needed - yay MySQL.
        > create database quilt;

* Create a virtual env
* Install the server package and its dependencies:

        $ pip install -e .

* Add these to the env's `postactivate` script:

        export FLASK_APP=quilt_server
        export FLASK_DEBUG=1
        export QUILT_SERVER_CONFIG=dev_config.py

        # Get these from the old server:
        export AWS_ACCESS_KEY=...
        export AWS_SECRET_KEY=...

        # Get this one from the stage API app
        # (https://quilt-heroku.herokuapp.com/admin/oauth2_provider/application/3/)
        export OAUTH_CLIENT_SECRET=...

* Activate the environment again - make sure the variables got set
* Initialize the database tables:

        flask db upgrade

## Run

    flask run

## DB Migrations
Create a new migrations file:

    flask db migrate

Apply the migration:

    flask db upgrade

Don't forget to add it to the repo:

    git add migrations/versions/[whatever].py
