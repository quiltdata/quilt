#!/bin/bash
set -exo pipefail

if [ -z "$INTERNAL_REGISTRY_URL" ]
then
    echo "INTERNAL_REGISTRY_URL not set"
    exit 1
fi

INTERNAL_REGISTRY_URL=${INTERNAL_REGISTRY_URL%%/} # Remove a trailing slash.

# Get the DNS server from /etc/resolv.conf
nameserver=$(awk '{if ($1 == "nameserver") { print $2; exit;}}' < /etc/resolv.conf)

if [[ "$nameserver" == *:*:* ]]
then
    # IPv6; put brackets around it.
    nameserver="[$nameserver]"
fi

export NAMESERVER=$nameserver

envsubst '$INTERNAL_REGISTRY_URL $NAMESERVER' < /root/nginx.conf.tmpl > /tmp/nginx.conf

exec nginx -g 'daemon off;'
