#!/usr/bin/env bash

rm -f cli.md
touch cli.md

gen_cmd_docs () {
    CMD=$1

    echo '## `'${CMD}'`' >> cli.md
    echo '```' >> cli.md
    quilt3 ${CMD} -h >> cli.md
    echo '```' >> cli.md
}

gen_env_docs () {
  env=$1
  env_cmd=$2
  desc=$3

  echo '### `'${env}'`' >> cli.md
  echo ${desc} >> cli.md
  echo '```' >> cli.md
  echo ${env_cmd} >> cli.md
  echo '```' >> cli.md
}

echo "# Quilt3 CLI and environment" >> cli.md
echo "" >> cli.md

gen_cmd_docs 'catalog'
quilt3 catalog --detailed_help >> cli.md
gen_cmd_docs 'install'
gen_cmd_docs 'verify'
gen_cmd_docs 'login'
gen_cmd_docs 'logout'
gen_cmd_docs 'config'
gen_cmd_docs 'disable-telemetry'
gen_cmd_docs 'list-packages'
gen_cmd_docs 'push'
gen_cmd_docs 'config-default-remote-registry'

# Document environment varialbes and constants
cat env_constants.md >> cli.md

mv cli.md "../docs/api-reference/cli.md"
