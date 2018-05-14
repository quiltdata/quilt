Once your package is built, you can push it to the registry:
```bash
quilt login # requires free account
quilt build USR/PKG build.yml
quilt push USR/PKG --public
```
Users on Individual and Business plans can omit the ~~`--public`~~ flag to create private packages.

As with most Quilt commands, you can execute the above directly in Python:
```python
# log in to the registry (requires a free account)
quilt.login()
# build a package based on the current state of wine
quilt.build("USR/PKG", wine)
# push it to the registry
quilt.push("USR/PKG", public=True)
