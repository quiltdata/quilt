#!/bin/bash
# Pasted from https://code.djangoproject.com/wiki/CommitterTips#AutomatingBackports.
# The only change is the branch template.
if [ -z $1 ]; then
    echo "Full hash of commit to backport is required."
    exit
fi

BRANCH_NAME=`git branch | sed -n '/\* version-/s///p'`
echo $BRANCH_NAME

git reset --hard

REV=$1
: ${ORIGBRANCH=master}

TMPFILE=tmplog.tmp

# Cherry-pick the other commit
#ORIGID=`git find-rev r${REV} ${ORIGBRANCH}`
#if [ -z "${ORIGID}" ] ; then
#    echo "Revision ${REV} not found in branch ${ORIGBRANCH}"
#    exit 1
#fi
git cherry-pick ${REV}

# Create new log message by modifying the old one
git log --pretty=format:"[${BRANCH_NAME}] %s%n%n%b%nBackport of ${REV} from master" HEAD^..HEAD \
    | grep -v '^BP$' > ${TMPFILE}

# Commit new log message
git commit --amend -F ${TMPFILE}

# Clean up temporary files
rm -f ${TMPFILE}
