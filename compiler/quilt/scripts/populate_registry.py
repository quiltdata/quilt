import os
import re
from string import ascii_lowercase
import sys

import quilt

def mkdir(dir):
    if not os.path.isdir(dir):
        os.mkdir(dir)

mkdir('./tmp')
mkdir('./tmp/dir')
mkdir('./tmp/foo')

user = sys.argv[1]
user_regex = re.compile('^[a-z]+$')
if user_regex.match(user) is None:
    print('Invalid username')
    sys.exit(0)
    


for letter1 in ascii_lowercase:
    for letter2 in ascii_lowercase[0:3]:
        package_name = '%s/%s%s' % (user, letter1, letter2)
        with open('./tmp/README.md', 'w') as md:
            md.write('%s%s README\n' % (letter1, letter2))
        with open('./tmp/dir/README.md', 'w') as md:
            md.write('%s%s README\n' % (letter1, letter2))
        with open('./tmp/foo/README.md', 'w') as md:
            md.write('%s%s README\n' % (letter1, letter2))
        quilt.build(package_name, './tmp')
        quilt.push(package_name)
        os.remove('./tmp/README.md')
