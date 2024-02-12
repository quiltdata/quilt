#!/bin/bash

set -e

error() {
    echo $@ 2>&1
    exit 1
}

[[ $# == 2 ]] || error "Usage: $0 account_id image_name"

account_id=$1
image_name=$2

regions=$(aws ec2 describe-regions --query "Regions[].{Name:RegionName}" --output text)

for region in $regions
do
    docker_url=$account_id.dkr.ecr.$region.amazonaws.com
    echo "Logging in to $docker_url..."
    aws ecr get-login-password --region $region | docker login -u AWS --password-stdin "$docker_url"

    echo "Pushing to $region..."
    remote_image_name="$docker_url/$image_name"
    docker tag "$image_name" "$remote_image_name"
    docker push "$remote_image_name"
done

