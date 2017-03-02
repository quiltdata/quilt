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

        # TODO: Either switch to limited dev accounts, or set up a fake S3 server.
        # Get these from the old server:
        export AWS_ACCESS_KEY_ID=...
        export AWS_SECRET_ACCESS_KEY=...

        # Get this one from the stage API app
        # (https://quilt-heroku.herokuapp.com/admin/oauth2_provider/application/3/)
        export OAUTH_CLIENT_SECRET=...

* Activate the environment again - make sure the variables got set
* Initialize the database tables:

        flask db upgrade

## Run Flask directly

    flask run

## Run the Docker container

    docker build -t quiltdata/server .

    # Needs the dev config and the environment variables.
    docker run -p 5000:80 \
      -v $PWD/quilt_server/dev_config.py:/home/quilt/dev_config.py \
      -e QUILT_SERVER_CONFIG=/home/quilt/dev_config.py \
      -e AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
      -e AWS_SECRET_KEY="$AWS_SECRET_KEY" \
      -e OAUTH_CLIENT_SECRET="$OAUTH_CLIENT_SECRET" \
      quiltdata/server

## DB Migrations
Create a new migrations file:

    flask db migrate -m "[description of your changes]"

Edit the file, then apply the migration:

    flask db upgrade

Don't forget to add it to the repo:

    git add migrations/versions/[whatever].py
