from hashlib import sha256
import os
import random
import re
from string import ascii_lowercase
import sys

import quilt

def mkdir(dir):
    if not os.path.isdir(dir):
        os.mkdir(dir)

mkdir('./tmp')

try:
    user = sys.argv[1]
except:
    user = 'user'
user_regex = re.compile('^[a-z]+$')
if user_regex.match(user) is None:
    print('Invalid username')
    sys.exit(0)

def read_circ_buffer(file, n):
    ret = file.read(n)
    n -= len(ret)
    if n > 0:
        file.seek(0)
        return ''.join([ret, read_circ_buffer(file, n)])
    return ret

alice = open('aliceinwonderland')

"""
# test code
hashes = set()
for n in range(2500):
    b = read_circ_buffer(alice, 50000)
    s = sha256(b.encode()).hexdigest()
    if s in hashes:
        raise Exception('agh! ' + s)
    hashes.add(s)
"""

for letter1 in ascii_lowercase:
    repeat = letter1 * 5
    for letter2 in ascii_lowercase[0:3]:
        package_name = '%s/%s%s' % (user, letter1, letter2)
        with open('./tmp/README.md', 'w') as md:
            md.write("%s%s README\n\n" % (letter1, letter2))
            md.write(repeat + "\n\n")
            # part of Alice
            p = read_circ_buffer(alice, 50000)
            # hash of part of Alice
            s = sha256(p.encode()).hexdigest()
            md.write(s + "\n\n")
            # write section of alice
            md.write(p + "\n\n")
        quilt.build(package_name, './tmp')
        quilt.push(package_name)
        os.remove('./tmp/README.md')
