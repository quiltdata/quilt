#!/bin/bash
# This script can be use git commit hook
# Place script as .git/hooks/pre-commit

PYLINT_VERSION='1.7.2'
PYLINT_ARGS='--enable=W,E --disable=C'
EXIT_ON_WARNING_ERROR=1
# Use 0 if need to avoid pylint failure and proceed to 'git commit'

#
# Checking.. if pylint install 
#
python -c "import pylint"
if [[ $? -ne 0 ]]
then
  	echo "$0: Pylint not installed!"
	echo "$0: Do pip install pylint==$PYLINT_VERSION"
	exit 1
fi

#
# Checking pylint version, (easy to parse pip freeze than pylint --version)
#
pylint_version=$(pip freeze | grep pylint | awk -F'==' '{ print $2 }')
if [[ $pylint_version != $PYLINT_VERSION ]]
then
	echo "$0: Pylint version mismatch!"
	echo "$0: Do pip install pylint==$PYLINT_VERSION"
	exit 1
fi

#
# Checking for specified directories inside repo 
#
for i in "registry" "compiler"
do
	echo "$0: Checking $i directory.."
	# purpose of changing directory is to use already existing pylintrc as default pylint config
	pushd $i && find . -iname "*.py" | xargs pylint $PYLINT_ARGS >> /dev/null
	if [[ $? -ne 0 ]]
	then
  		echo "$0: Pylint failed in $i!"
		if [[ $EXIT_ON_WARNING_ERROR -eq 1 ]]
		then
			echo "$0: Stop iterating.."
			exit 1
		fi	
	fi
	popd
	# otherwise hook exit with 0
done
