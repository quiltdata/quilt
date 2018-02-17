# Package Composition (BETA)

The `package` keyword in `build.yml` allows packages to be built from other existing packages or components of existing packages.

## Known Issues
- [ ] included packages must exist and be installed locally
- [ ] only package instances with the `latest` tag can be included
- [ ] users are not warned when information from private packages is included in new packages that are later made published

Example `build.yml`:
``` yaml
---
contents:
  NODENAME:                                     # Create a package with a node called `NODENAME`
    package: OWNER/EXISTING_PACKAGE/DATAFRAME   # Pull its contents from a node, `DATAFRAME`, in an
                                                # existing package, `OWNER/EXISTING_PACKAGE`.
```
