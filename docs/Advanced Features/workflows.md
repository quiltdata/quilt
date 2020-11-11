*New in Quilt 3.3*

`quilt3` provides an API to ensure the quality of package metadata. To get started, create a
configuration file in your registry under `.quilt/workflows/config.yml`. For example:

```yaml
version: "1"
workflows:
  alpha:
    name: Search for aliens
    is_message_required: true
  beta:
    name: Studying superpowers
    metadata_schema: superheroes
  gamma:
    name: Nothing special
    description: TOP SECRET
    is_message_required: true
    metadata_schema: top-secret
schemas:
 superheroes:
   url: s3://quilt-sergey-dev-metadata/schemas/superheroes.schema.json
 top-secret:
   url: s3://quilt-sergey-dev-metadata/schemas/top-secret.schema.json
```

With the above configuration you must specify a workflow before you can push:

```python
>>> import quilt3
>>> quilt3.Package().push('test/package', registry='s3://quilt-sergey-dev-metadata')

QuiltException: Workflow is required, but none specified.
```


Let's try with with `workflow` parameter set:

```python
>>> quilt3.Package().push('test/package', registry='s3://quilt-sergey-dev-metadata', workflow='alpha')

QuiltException: Commit message is required by workflow, but none was provided.
```

This behavior is caused by `is_message_required: true` option. It requires you specify a `message` parameter:
```python
>>> quilt3.Package().push(
        'test/package',
        registry='s3://quilt-sergey-dev-metadata',
        message='added info about UFO',
        workflow='alpha')

Package test/package@bc9a838 pushed to s3://quilt-sergey-dev-metadata
```

Now let's push with `workflow='beta'`:

```python
>>> quilt3.Package().push('test/package', registry='s3://quilt-sergey-dev-metadata', workflow='beta')

QuiltException: Metadata failed validation: 'superhero' is a required property.
```

It fails because we have `metadata_schema: superheroes` specified for `beta` workflow. It makes package
metadata to be validated against [JSON Schema](https://json-schema.org/) located at
`s3://quilt-sergey-dev-metadata/schemas/superheroes.schema.json`.

Here's it that schema:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://example.com/superheroes.schema.json",
  "properties": {
    "superhero": {
      "enum": [
        "Spider-Man",
        "Superman",
        "Batman"
      ]
    }
  },
  "required": [
    "superhero"
  ]
}
```

It requires `superhero` property to be set:

```python
>>> quilt3.Package().set_meta({'superhero': 'Batman'}).push(
        'test/package',
        registry='s3://quilt-sergey-dev-metadata',
        workflow='beta')

Package test/package@c4691d8 pushed to s3://quilt-sergey-dev-metadata
```

> Currently there are these limitations is JSON Schema support:
> * only [Draft 7 Json Schemas](https://json-schema.org/specification-links.html#draft-7) are supported
> * schemas with [`$ref`](https://json-schema.org/draft-07/json-schema-core.html#rfc.section.8.3) are not supported
> * schemas must be on S3

For `gamma` workflow both `is_message_required: true` and `metadata_schema` are set, so both `message`
and package metadata are validated:

```python
>>> quilt3.Package().push('test/package', registry='s3://quilt-sergey-dev-metadata', workflow='gamma')

QuiltException: Metadata failed validation: 'answer' is a required property.

>>> quilt3.Package().set_meta({'answer': 42}).push(
        'test/package',
        registry='s3://quilt-sergey-dev-metadata',
        workflow='gamma')

QuiltException: Commit message is required by workflow, but none was provided.

>>> quilt3.Package().set_meta({'answer': 42}).push(
        'test/package',
        registry='s3://quilt-sergey-dev-metadata',
        message='at last all is set up',
        workflow='gamma')

Package test/package@6331508 pushed to s3://quilt-sergey-dev-metadata
```

You can make workflow validation optional, you need to set `is_workflow_required: false` in config and
specify `workflow=None`:

```python
>>> quilt3.Package().push('test/package', registry='s3://quilt-sergey-dev-metadata', workflow=None)

Package test/package@06b2815 pushed to s3://quilt-sergey-dev-metadata
```

Also `default_workflow` can be set in config to specify which workflow will be used
if `workflow` parameter is not provided.

You could also check
[JSON Schema](https://github.com/quiltdata/quilt/blob/master/api/python/quilt3/workflows/config-1.schema.json)
that is used for validation of workflow file.
