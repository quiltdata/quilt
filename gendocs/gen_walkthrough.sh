#!/usr/bin/env bash

gen_cmd_docs () {
    file=$1

    rm -f "${file}".md
    jupyter nbconvert --to markdown "${file}".ipynb
}

gen_cmd_docs '../docs/Advanced Features/Working with Manifests'
gen_cmd_docs '../docs/Walkthrough/Editing a Package'
gen_cmd_docs '../docs/Walkthrough/Getting Data from a Package'
gen_cmd_docs '../docs/Walkthrough/Installing a Package'
gen_cmd_docs '../docs/Walkthrough/Uploading a Package'
gen_cmd_docs '../docs/Walkthrough/Working with a Bucket'
