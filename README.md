# Quilt Server

## Install
* Install and start MySQL
* Create a `quilt` database:
  ```
  $ mysql -u root  # No password needed - yay MySQL.
  > create database quilt;
  ```
* Create a virtual env
* `pip install -r requirements.txt`
* Add these to the env's `postactivate` script:
  ```
  export FLASK_APP=app.py
  export FLASK_DEBUG=1
  ```
* Activate the environment again - make sure the variables got set
* `flask db upgrade`

## Run
```
flask run
```

## DB Migrations
(Not actually tested yet...)
```
flask db migrate
flask db upgrade
```
