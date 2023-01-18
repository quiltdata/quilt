<!--pytest-codeblocks:skipfile-->
<!-- markdownlint-disable -->
*New in Quilt 3.3*


# Workflows
A Quilt *workflow* is a quality gate that you set to ensure the quality of your
data and metadata *before* it becomes a Quilt package. You can create as many
workflows as you like to accommodate all of your data creation patterns.

> By default, workflows are **required**.

## On data quality
Under the hood, Quilt workflows use [JSON Schema](https://json-schema.org) to check that
package metadata have the right *shape*. Metadata shape determines which keys are
defined, their values, and the types of the values.

Ensuring the quality of your data has long-lasting implications:
1. Consistency - if labels and other metadata don't use a consistent, controlled
vocabulary, reuse becomes difficult and trust in data declines
1. Completeness - if your workflows do not require users to include files,
documentation, labels, etc. then your data is on its way towards becoming mystery
data and ultimately junk data that no one can use
1. Context - data can only be reused if users know where it came from, what it means,
who touched it, and what the related datasets are

From the standpoint of querying engines like Amazon Athena, data that lacks
consistency and completeness is extremely difficult to query longitudinally and
depreciates over time (as team members change, platforms change,
and tribal knowledge is lost).

## Use cases
* Ensure that labels are correct and drawn from a controlled vocabulary (e.g.
ensure that the only labels in a package of images are either "bird" or "not bird";
avoid data entry errors like "birb")
* Ensure that users provide a `README.md` for every new package
* Ensure that included files are non-empty
* Ensure that every new package (or dataset) has enough labels so that it can be
reused (e.g. Date, Creator, Type, etc.)

## Get started
To get started, create a configuration file in your Quilt S3 bucket
at `s3://BUCKET-NAME/.quilt/workflows/config.yml`.

Here's an example:
```yaml
version:
  base: "1"
  catalog: "1"
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
    handle_pattern: ^(employee1|employee2)/(staging|production)$
    entries_schema: validate-secrets
    catalog:
      package_handle:
        files: <%= username %>/<%= directory %>
        packages: <%= username %>/production
schemas:
  superheroes:
    url: s3://quilt-dev-metadata/schemas/superheroes.schema.json
  top-secret:
    url: s3://quilt-dev-metadata/schemas/top-secret.schema.json
  validate-secrets:
    url: s3://quilt-dev-metadata/schemas/validate-secrets.schema.json
```

With the above configuration, you must specify a workflow before you can push:

<!--pytest-codeblocks:cont-->
<!--pytest.mark.xfail-->
```python
import quilt3
quilt3.Package().push('test/package', registry='s3://quilt-dev-metadata')

# QuiltException: Workflow required, but none specified.
```

Let's try with the `workflow=` parameter:

<!--pytest-codeblocks:cont-->
<!--pytest.mark.xfail-->
```python
quilt3.Package().push('test/package', registry='s3://quilt-dev-metadata', workflow='alpha')

# QuiltException: Commit message is required by workflow, but none was provided.
```

The above `QuiltException` is caused by `is_message_required: true`.
Here's how we can pass the workflow:

<!--pytest-codeblocks:cont-->
```python
quilt3.Package().push(
        'test/package',
        registry='s3://quilt-dev-metadata',
        message='added info about UFO',
        workflow='alpha')

# Package test/package@bc9a838 pushed to s3://quilt-dev-metadata
```

Now let's push with `workflow='beta'`:

<!--pytest-codeblocks:cont-->
<!--pytest.mark.xfail-->
```python
quilt3.Package().push(
        'test/package',
        registry='s3://quilt-dev-metadata',
        workflow='beta')

# QuiltException: Metadata failed validation: 'superhero' is a required property.
```

We encountered another exception because the `beta` workflow specifies
`metadata_schema: superheroes`.
Therefore, the `test/package` metadata must validate against the
[JSON Schema](https://json-schema.org/) at
`s3://quilt-dev-metadata/schemas/superheroes.schema.json`:
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

<!--pytest-codeblocks:cont-->
```python
quilt3.Package().set_meta({'superhero': 'Batman'}).push(
        'test/package',
        registry='s3://quilt-dev-metadata',
        workflow='beta')

# Package test/package@c4691d8 pushed to s3://quilt-dev-metadata
```

For the `gamma` workflow, both `is_message_required: true` and `metadata_schema`
are set, so both `message` and package metadata are validated:

<!--pytest-codeblocks:cont-->
<!--pytest.mark.xfail-->
```python
quilt3.Package().push(
        'test/package',
        registry='s3://quilt-dev-metadata',
        workflow='gamma')

# QuiltException: Metadata failed validation: 'answer' is a required property.

quilt3.Package().set_meta({'answer': 42}).push(
        'test/package',
        registry='s3://quilt-dev-metadata',
        workflow='gamma')

# QuiltException: Commit message is required by workflow, but none was provided.

quilt3.Package().set_meta({'answer': 42}).push(
        'test/package',
        registry='s3://quilt-dev-metadata',
        message='at last all is set up',
        workflow='gamma')

# Package test/package@6331508 pushed to s3://quilt-dev-metadata
```

## Bypassing workflow validation and setting a default workflow
As stated above, by default workflows are **required**. If you wish
for your users to be able to skip workflow validation altogether, you can
make workflow validation optional with `is_workflow_required: False`
at the top-level in your `config.yml` file:

```yaml
version:
  base: "1"
  catalog: "1"
is_workflow_required: False
```

Now your users can specify `workflow=None` in the Python API (or
`--workflow ''` in the CLI) when they push packages.

<!--pytest-codeblocks:cont-->
<!--pytest.mark.xfail-->
```python
quilt3.Package().push(
        'test/package',
        registry='s3://quilt-dev-metadata',
        workflow=None)

# Package test/package@06b2815 pushed to s3://quilt-dev-metadata
```

In addition, a `default_workflow` value can also be set at the top-level in your
`config.yml` file:

```yaml
version:
  base: "1"
  catalog: "1"
default_workflow: "experiment"
is_workflow_required: False
workflows:
  experiment:
    name: Experiment
    metadata_schema: experiment-universal
schemas:
  experiment-universal:
    url: s3://quilt-dev-metadata/.quilt/workflows/schemas/experiment-universal.json
```

This specifies which workflow will be used (`experiment`) if a
`workflow` parameter in the `Package.push()` API call or CLI is not provided.

## JSON Schema
- Quilt workflows support the [Draft 7 JSON Schema](https://json-schema.org/specification-links.html#draft-7).
- JSON schemas can be stored anywhere in your Amazon S3 bucket. 
Provided the path to the file is accessible in `config.yml`, the
schema will successfully validate your package metadata shape.

### Default values
Quilt supports the
[`default` keyword](https://json-schema.org/understanding-json-schema/reference/generic.html?highlight=default).

### Auto-fill dates
If you wish to pre-populate dates in the Quilt catalog, you can use the custom
keyword `dateformat` in your schemas. For example:

```json
{
    "type": "string",
    "format": "date",
    "dateformat": "yyyy-MM-dd"
}
```
The `dateformat` template follows
[Unicode Technical Standard #35](https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table).

### Arrays, tuples and enums
Quilt supports the [`array` data type](https://json-schema.org/understanding-json-schema/reference/array.html). 
You can use `array` if you need to define a list of metadata values for a metadata key.
These elements can be of any type.

If the order in the list is not significant, use "arrays" (using `"items"` and `"anyOf"`):

```json
{
    "type": "array",
    "items": {
        "anyOf": [
            {
                "type": "string"
            },
            {
                "type": "number"
            }
        ]
    }
}
```

With this Schema you can create a list of metadata values such as:
`["Any string A", 123, "Any string B"]` or `[123, "Any string", 456]`

If the order in the list is important and the list is fixed in
length, then use "tuples" (using `"items"`, `"minItems"`, and `"maxItems"`):

```json
{
    "type": "array",
    "items": [
        {
            "type": "string"
        },
        {
            "type": "number"
        }
    ],
    "minItems": 2,
    "maxItems": 2
}
```

With this Schema you can create strictly ordered lists, such as `["Any string", 123]`.

An incorrect order will return an error `[123, "Any string"] // invalid`.

> Remember that you should define `"minItems"` and `"maxItems"` or
`"minItems"` and `"additonalItems": false`, because "tuples" must have
a fixed size.

Instead of letting users set any metadata value, you can define list of
available options with `enum`:

```json
{
    "type": "array",
    "items": {
        "type": "string",
        "enum": ["Fixed 1", "Fixed 2"]
    }
}
```

With this Schema you can create a list of any length
with predefined values, such as `["Fixed 1", "Fixed 2", "Fixed 1"]`.

```json
{
    "type": "array",
    "items": [
        "type": "string",
        "enum": ["Fixed 1", "Fixed 2"]
    ],
    "minItems": 1,
    "additionalItems": false,
}
```

With this Schema users are allowed to create tuples like `["Fixed 1"]` or `["Fixed 2"]`.

If you want to provide users with a list of predefined metadata values but
additionally let them add any values outside of this list, you can use the `anyOf`
keyword:

```json
{
    "type": "array",
    "items": {
        "anyOf": [
            {
                "type": "string"
                "enum": ["Fixed 1", "Fixed 2"]
            },
            {
                "type": "string"
            }
        ]
    }
}
```

Metadata lists such as 
`["Fixed 1", "Fixed 2"]`, `["Fixed 1", "Any string"]` or `["Any string 1", "Any string 2"]` 
are all valid.

In certain use cases you may want to define metadata lists that
have first-ordered items of predefined values, and the rest are any
other outside of the predefined values. Then you create
tuples with `"additionalItems": true`:

```json
{
    "type": "array",
    "items": [
        "type": "string",
        "enum": ["Fixed 1", "Fixed 2"]
    ],
    "minItems": 1,
    "additionalItems": true,
}
```

With this Schema lists such as 
`["Fixed 1", "Any string", 123]` 
are valid but `["Any string", 123]` are invalid.

### Example properties
The following examples show how you can specify complex `properties`
such as `object`, `array`, and compound `enum` types.

#### Objects

```json
{
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "id": {
              "default": 123,
              "type": "number"
            },
            "name": {
              "default": "Optional default value",
              "type": "string"
            }
        }
    }
}
```

#### Compound enums: arrays

```json
{
    "type": "array",
    "enum": [
        [1, 2, 3],
        [3, 4, 5],
        [6, 7, 8]
    ]
}
```

#### Compound enums: objects

```json
{
    "type": "object",
    "enum": [
        {"id": 1},
        {"id": 2},
        {"id": 3}
    ]
}
```

#### Compound enums: arrays and objects

```json
{
    "type": "array",
    "enum": [
        ["miles", {
            "format": "12h"
        }],
        ["kilometers", {
            "format": "24h"
        }],
        {
            "name": "unspecified"
        }
    ]
}
```

This allows for flexible and extensible schema definition, and hence
validation, of complex metadata schemas to any depth.

> Quilt currently uses the Draft 4 Json Schema where tuples are
validated with `items`, and not `prefixItems`.
The `prefixItems` keyword was added in Draft 2020-12, and is not currently supported.

## Data quality controls
In addition to package-level metadata. Quilt workflows enable you to validate
package names, and basic file metadata.
> You must include the following schema version at the root of your config.yml in order for
> any catalog-specific features to function:

```yaml
version:
  base: "1"
  catalog: "1"
```
### Package name defaults (Quilt catalog)
By default the Quilt catalog auto-fills the package handle **prefix** according to the following logic:
* Packages tab: username (everything before the @ in your sign-in email).
Equivalent to
```yaml
catalog:
  package_handle:
    packages: <%= username %>
```
* Files tab: parent directory name. Equivalent to
```yaml
catalog:
  package_handle:
    files: <%= directory %>
```

You can customize the default prefix with `package_handle` key in one or both of
the following places:
* Set `catalog.package_handle.(files|packages)` at the root of config.yml to affect all workflows
* Set `workflows.WORKFLOW.catalog.package_handle.(files|packages)` to affect the tabs
and workflow in question

#### Example

```yaml
catalog:
  # default for all workflows for Packages tab
  package_handle:
    packages: analysis/
workflows:
  my-workflow:
    name: My workflow
    catalog:
      # defaults for my-workflow, different for each tab
      package_handle:
        files: <%= username %>/<%= directory %>
        packages: <%= username %>/production
```

### Package name validation
You can validate package names with `WORKFLOW.handle_pattern`, which accepts
[JavaScript regular expression](https://datatracker.ietf.org/doc/html/draft-handrews-json-schema-validation-01#section-6.3.3).

> By default, patterns are not anchored.
> You can explicitly add start (`^`) and end (`$`) markers as needed.

#### Example

```yaml
workflows:
  name: My workflow
  my-workflow:
    handle_pattern: ^(employee1|employee2)/(production|staging)$
```

### Package file validation
You can validate the names and sizes of files in the package with
`WORKFLOW.entries_schema`. The provided schema runs against an array of
objects known as *package entries*. Each package entry defines a logical key
(its relative path and name in the parent package) and size (in bytes).

#### Example

```yaml
workflows:
  myworkflow-1:
    name: 'My workflow #1'
    entries_schema: must-contain-readme
  myworkflow-2:
    name: 'My workflow #2'
    entries_schema: must-contain-readme-summarize-at-least-1byte
    description: Must contain non-empty README.md and quilt_summarize.json at package root; no more than 4 files
schemas:
  must-contain-readme:
    url: s3://bucket/must-contain-readme.json
  must-contain-readme-summarize-at-least-1byte:
    url: s3://bucket/must-contain-readme-summarize-at-least-1byte.json
```

##### `s3://bucket/must-contain-readme.json`

Requires a README

```json
{
  "type": "array",
  "contains": {
    "type": "object",
    "properties": {
      "logical_key": {
        "type": "string",
        "pattern": "^README\\.md$"
      }
    }
  }
}
```

##### `s3://bucket/must-contain-readme-summarize-at-least-1byte.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "size": {
            "type": "number",
            "minimum": 1,
            "maximum": 100000
          }
        }
      },
      "minItems": 2,
      "maxItems": 4
    },
    {
      "type": "array",
      "contains": {
        "type": "object",
        "properties": {
          "logical_key": {
            "type": "string",
            "pattern": "^README\\.md$"
          }
        }
      }
    },
    {
      "type": "array",
      "contains": {
        "type": "object",
        "properties": {
          "logical_key": {
            "type": "string",
            "pattern": "^quilt_summarize\\.json$"
          }
        }
      }
    }
  ]
}
```

### Cross-bucket package push (Quilt catalog)
In Quilt, S3 buckets are like git branches but for data. With `quilt3` you can
`browse` any package and then `push` it to any bucket that you choose.

As a rule, cross-bucket pushes or "merges" reflect change in a package's
lifecycle. For example, you might push a package from  *my-staging-bucket*
to *my-production-bucket* as it matures and becomes trusted.

The catalog's
[Push to bucket](../walkthrough/working-with-the-catalog.md)
feature can be enabled by adding a `successors` property to the config.
A *successor* is a destination bucket.

```yaml
version:
  base: "1"
workflows:
  dummy:
    name: Dummy
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

## `config.yml` JSON Schema
See
[workflows-config_catalog-1.0.0.json](https://github.com/quiltdata/quilt/blob/master/shared/schemas/workflows-config_catalog-1.0.0.json)
and
[workflows-config-1.1.0.json](https://github.com/quiltdata/quilt/blob/master/shared/schemas/workflows-config-1.1.0.json).


## Known limitations
* Only [Draft 7 Json Schemas](https://json-schema.org/specification-links.html#draft-7) are supported
  * If a workflow schema includes a non-supported keyword, the user
  interface displays an `unknown keyword: <non-supported keyword>`
  error
* Schemas with
[`$ref`](https://json-schema.org/draft-07/json-schema-core.html#rfc.section.8.3)
are not supported
* Schemas must be in an S3 bucket for which the Quilt user has read permissions
