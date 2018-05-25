# Push a package
Pushing a package stores a built package in a server-side registry. Push a package
to back up changes or share your package with others.

```bash
$ quilt login # requires free account
$ quilt push USR/PKG --public
```

Or, in Python:
```python
# log in to the registry (requires a free account)
quilt.login()
# push it to the registry
quilt.push("USR/PKG", is_public=True)
```

Users on Individual and Business plans can omit the ~~is_public=True~~ to create private packages.
