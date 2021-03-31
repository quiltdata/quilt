## Managing tabs and buttons visibility

Administrator is able to hide buttons and navigation tabs from any bucket. Each bucket has its own configuration file at `s3://BUCKET/.quilt/catalog/config.yaml`

If no configuration file is provided, than default config is in use:

```
ui:
  nav:
    files: True
    packages: True
    queries: True
  actions:
    copyPackage: True
    createPackage: True
    revisePackage: True
```

### Available properties:

* `ui.nav.files` hides Files tab
* `ui.nav.packages` hides Packages tab
* `ui.nav.queries` hides Queries tab
* `ui.actions.copyPackage`hides buttons triggering Create Package dialog, both creating package from scratch and from directory
* `ui.actions.createPackage` hides button triggering Revise Package dialog
* `ui.actions.revisePackage` hides button triggering Push to Bucket dialog