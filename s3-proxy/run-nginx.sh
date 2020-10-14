#!/bin/bash

if [ -z "$REGISTRY_URL" ]
then
    echo "REGISTRY_URL not set"
    exit 1
fi

REGISTRY_URL=${REGISTRY_URL%%/} # Remove a trailing slash.

# Get the DNS server from /etc/resolv.conf
nameserver=$(awk '{if ($1 == "nameserver") { print $2; exit;}}' < /etc/resolv.conf)

if [[ "$nameserver" == *:*:* ]]
then
    # IPv6; put brackets around it.
    nameserver="[$nameserver]"
fi

export NAMESERVER=$nameserver

envsubst '$REGISTRY_URL $NAMESERVER' < /root/nginx.conf.tmpl > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
