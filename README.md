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
        export OAUTH_BASE_URL='https://quilt-heroku.herokuapp.com'
        export OAUTH_CLIENT_ID='chrOhbIPVtJAey7LcT1ez7PnIaV9tFLqNYXapcG3'
        export OAUTH_CLIENT_SECRET='ihhjjcPioqbdsNyo6xfjMmTALqsJzSLgVWd5SgPfAJ5gxRBUCjZR7jT8Yy2IJrVpNbd0UHaKJHoBlFgjwwokTiaOEnmjGtS6KwaPDaXRb1jbrHkvpX82CNNAtwV44Nt3'


* Activate the environment again - make sure the variables got set
* Initialize the database tables:

        flask db upgrade

## Run

    flask run

## DB Migrations
(Not actually tested yet...)

    flask db migrate
    flask db upgrade
