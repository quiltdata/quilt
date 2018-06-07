# quilt.yml requirements

Just as you can use `requirements.txt` to specify code dependencies, you can use
`quilt.yml` to specify data package dependencies.

## Install dependencies

```sh
$ quilt install [@FILENAME=quilt.yml]
# If @FILENAME is absent, default to ./quilt.yml
```

Installs a list of packages specified by a YAML file.

## Syntax

The YAML file must contain a `packages` node with a list of packages:

```yaml
  packages:
    - USER/PACKAGE[/SUBPACKAGE][:h[ash]|:t[ag]|:v[ersion]][:HASH|TAG|VERSION]
```

## Example

  ```yaml
  packages:
    - vgauthier/DynamicPopEstimate   # latest
    - danWebster/sgRNAs:a972d92      # specific hash
    - examples/sales:tag:latest      # specific tag
    - asah/snli:v:1.0                # specific version
  ```
