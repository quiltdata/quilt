#!/bin/bash

envsubst < /etc/nginx/nginx-quilt.template > /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;'
