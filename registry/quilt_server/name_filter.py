bad_names = set([
    'TEAM',
    'PUBLIC'
])

def blacklisted_name(username):
    return username in bad_names
