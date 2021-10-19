#!/usr/bin/env bash

gen_cmd_docs () {
    file=$1

    rm -f "${file}".md
    jupyter nbconvert --to markdown "${file}".ipynb
}

gen_cmd_docs '../docs/advanced-features/working-with-manifests'
gen_cmd_docs '../docs/walkthrough/editing-a-package'
gen_cmd_docs '../docs/walkthrough/getting-data-from-a-package'
gen_cmd_docs '../docs/walkthrough/installing-a-package'
gen_cmd_docs '../docs/walkthrough/uploading-a-package'
gen_cmd_docs '../docs/walkthrough/working-with-a-bucket'
