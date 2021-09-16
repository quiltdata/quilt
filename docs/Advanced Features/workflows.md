*New in Quilt 3.3*


### Workflows basics
A *workflow* is a quality gate that your data must pass in order to be pushed
to S3. To get started, create a configuration file in your Quilt S3 bucket
at `s3://BUCKET/.quilt/workflows/config.yml`.

Here's an example:
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

With the above configuration, you must specify a workflow before you can push:

```python
>>> import quilt3
>>> quilt3.Package().push('test/package', registry='s3://quilt-sergey-dev-metadata')

QuiltException: Workflow required, but none specified.
```

Let's try with the `workflow=` parameter:

```python
>>> quilt3.Package().push('test/package', registry='s3://quilt-sergey-dev-metadata', workflow='alpha')

QuiltException: Commit message is required by workflow, but none was provided.
```

The above `QuiltException` is caused by `is_message_required: true`.
Here's how we can pass the workflow:
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
>>> quilt3.Package().push(
        'test/package',
        registry='s3://quilt-sergey-dev-metadata',
        workflow='beta')

QuiltException: Metadata failed validation: 'superhero' is a required property.
```

We encountered another exception because the `beta` workflow specifies
`metadata_schema: superheroes`.
Therefore, the `test/package` metadata must validate against the
[JSON Schema](https://json-schema.org/) at
`s3://quilt-sergey-dev-metadata/schemas/superheroes.schema.json`:
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

Note that `superhero` is a required property:

```python
>>> quilt3.Package().set_meta({'superhero': 'Batman'}).push(
        'test/package',
        registry='s3://quilt-sergey-dev-metadata',
        workflow='beta')

Package test/package@c4691d8 pushed to s3://quilt-sergey-dev-metadata
```

For the `gamma` workflow, both `is_message_required: true` and `metadata_schema`
are set, so both `message` and package metadata are validated:

```python
>>> quilt3.Package().push(
        'test/package',
        registry='s3://quilt-sergey-dev-metadata',
        workflow='gamma')

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

If you wish for your users to be able to skip workflows altogether, you can make
workflow validation optional with `is_workflow_required: false` in your `config.yml`,
and specify `workflow=None` in the API:

```python
>>> quilt3.Package().push(
        'test/package',
        registry='s3://quilt-sergey-dev-metadata',
        workflow=None)

Package test/package@06b2815 pushed to s3://quilt-sergey-dev-metadata
```

Also `default_workflow` can be set in the config to specify which workflow will be used
if `workflow` parameter is not provided.


### Pushing across buckets with the Quilt catalog
The catalog's [Push to bucket](../Walkthrough/Working%20with%20the%20Catalog.md)
feature can be enabled by adding a `successors` property to the config.
A *successor* is a destination bucket.

```yaml
successors:
  s3://bucket1:
    title: Staging
    copy_data: false
  s3://bucket2:
    title: Production
```

If `copy_data` is `true` (the default), all package entries will be copied to the
destination bucket. If `copy_data` is `false`, all entries will remain in their
current locations.

### Default values
Quilt supports the
[`default` JSON Schema keyword](https://json-schema.org/understanding-json-schema/reference/generic.html?highlight=default).

#### Auto-filling dates
If you wish to pre-populate dates in the Quilt catalog, you can use the custom
keyword `dateformat` in your schemas. For example:

```
{
    "type": "string",
    "format": "date",
    "dateformat": "yyyy-MM-dd"
}
```
The `dateformat` template follows
[Unicode Technical Standard #35](https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table).


### Full `config.yml` schema
See
[config-1.schema.json](https://github.com/quiltdata/quilt/blob/master/api/python/quilt3/workflows/config-1.schema.json).


### Known limitations
* Only [Draft 7 Json Schemas](https://json-schema.org/specification-links.html#draft-7) are supported
* Schemas with [`$ref`](https://json-schema.org/draft-07/json-schema-core.html#rfc.section.8.3) are not supported
* Schemas must be in an S3 bucket for which the Quilt user has read permissions
