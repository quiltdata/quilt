#!/bin/bash

# Get the DNS server from /etc/resolv.conf
nameserver=$(awk '{if ($1 == "nameserver") { print $2; exit;}}' < /etc/resolv.conf)

if [[ "$nameserver" == *:*:* ]]
then
   # IPv6; put brackets around it.
   nameserver="[$nameserver]"
fi

# Add it to the NGINX config
echo "resolver $nameserver;" > /etc/nginx/conf.d/resolver.conf

exec nginx -g 'daemon off;'
