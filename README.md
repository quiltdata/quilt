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

* Activate the environment again - make sure the variables got set
* Initialize the database tables:

        flask db upgrade

## Run

    flask run

## DB Migrations
(Not actually tested yet...)

    flask db migrate
    flask db upgrade
