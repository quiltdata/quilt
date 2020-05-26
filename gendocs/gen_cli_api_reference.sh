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

# Document environment variables
echo '## Environment variables' >> cli.md
gen_env_docs QUILT_DISABLE_USAGE_METRICS '$ export QUILT_DISABLE_USAGE_METRICS=true' \
'Disable anonymous usage collection. Defaults to `False`'

gen_env_docs QUILT_MINIMIZE_STDOUT '$ export QUILT_MINIMIZE_STDOUT=true' \
'Turn off TQDM progress bars for log files. Defaults to `False`'


# Document Constants
echo '## Constants (see [util.py](https://github.com/quiltdata/quilt/blob/master/api/python/quilt3/util.py) for more)' >> cli.md
echo '- `APP_NAME`' >> cli.md
echo '- `APP_AUTHOR`' >> cli.md
echo '- `BASE_DIR` - Base directory of the application' >> cli.md
echo '- `BASE_PATH` - Base pathlib path for the application directory' >> cli.md
echo '- `CACHE_PATH` - Pathlib path for the user cache directory' >> cli.md
echo '- `TEMPFILE_DIR_PATH` - Base pathlib path for the application `tempfiles`' >> cli.md
echo '- `CONFIG_PATH` - Base pathlib path for the application configuration file' >> cli.md
echo '- `OPEN_DATA_URL` - Application data url' >> cli.md
echo '- `PACKAGE_NAME_FORMAT` - Regex for legal package names' >> cli.md


mv cli.md "../docs/API Reference/cli.md"




