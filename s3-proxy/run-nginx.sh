#!/bin/bash

if [ -z "$REGISTRY_HOST" ]
then
    echo "REGISTRY_HOST not set"
    exit 1
fi

if [ -z "$INTERNAL_REGISTRY_URL" ]
then
    echo "INTERNAL_REGISTRY_URL not set"
    exit 1
fi

if [ $CERTIFICATE_ARN ]
then
    aws --region $(echo $CERTIFICATE_ARN | cut -d ":" -f 4) acm get-certificate --certificate-arn $CERTIFICATE_ARN --output text --query "join('', [Certificate, CertificateChain])" >> /etc/nginx/certs.pem
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

envsubst '$REGISTRY_HOST $INTERNAL_REGISTRY_URL $NAMESERVER' < /root/nginx.conf.tmpl > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
