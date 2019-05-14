T4 is an open source project, and we welcome contributions from the community.

Contributors must adhere to the [Code of Conduct](https://github.com/quiltdata/quilt/blob/master/docs/CODE_OF_CONDUCT.md).

## Reporting issues

Unsure about something? To get support, check out our [Slack channel](https://quiltusers.slack.com/messages).

Found a bug? File it in our [GitHub issues](https://github.com/quiltdata/t4/issues).

## Cloning

To work on `t4` you will first need to clone the repository.

```bash
$ git clone https://github.com/quiltdata/t4
```

You can then set up your own branch version of the code, and work on your changes for a pull request from there.

```bash
$ cd t4
$ git checkout -B new-branch-name
```

## Local package development

### Environment

Use `pip` to install `t4` locally (including development dependencies):

```bash
$ cd api/python
$ pip install -e .[extra]
```

This will create an [editable install](https://pip.pypa.io/en/stable/reference/pip_install/#editable-installs) of `t4`, allowing you to modify the code and test your changes right away.

### Testing

All new code contributions are expected to have complete unit test coverage, and to pass all preexisting tests.

Use `pytest` to test your changes during normal development. To run `pytest` on the entire codebase:

```bash
$ cd api/python/tests
$ pytest
```

When your branch is ready, you may run `tox` or `detox` to test a new install. To additionally test dependencies use `detox --refresh`, which will reset the environment it creates.

## Local catalog development

Note that, at the current time, it is only possible to run a local catalog if you already have a catalog deployed to AWS, because the catalog relies on certain services (namely, AWS Lambda and the AWS Elasticsearch Service) which cannot be run locally.

### Environment

Use `npm` to install the catalog (`t4-navigator`) dependencies locally:

```bash
$ cd catalog
$ npm install
```

There is one known issue with installation. At time of writing, the `t4-navigator` package depends on `iltorb@1.3.10`, which may lack prebuilt binaries for your platform and may fall back on building from source using `node-gyp`. `node-gyp` depends on Python 2; if you only have Python 3 in your install environment it will fail.

To fix this, point `npm` to a Python 2 path on your machine. For example on macOS:

```bash
$ npm config set python /usr/bin/python
$ npm install
```

Next, you need to create a `config.json` and `federation.json` file in the `catalog/static` subdirectory. For `federation.json` use the following template:

```json
{
   "buckets": [{
         "name":"quilt-example",
         "title":"Title here",
         "icon":"placeholder icon here",
         "description":"placeholder description here",
         "searchEndpoint":"$SEARCH_ENDPOINT",
         "apiGatewayEndpoint": "$PREVIEW_ENDPOINT",
         "region":"us-east-1"
      }
   ]
}
```

For `config.json` use the following template:

```json
{
   "federations": [
      "/federation.json"
   ],
   "suggestedBuckets": [
   ],
   "apiGatewayEndpoint": "$PREVIEW_ENDPOINT",
   "sentryDSN": "",
   "alwaysRequiresAuth": false,
   "defaultBucket": "t4-staging",
   "disableSignUp": true,
   "guestCredentials": {
      "accessKeyId": "$ACCESS_KEY_ID",
      "secretAccessKey": "$SECRET_ACCESS_KEY"
   },
   "intercomAppId": "",
   "mixpanelToken": "",
   "registryUrl": "$REGISTRY_ENDPOINT",
   "signInRedirect": "/",
   "signOutRedirect": "/"
}
```

### Build

To build a static code bundle, as would be necessary in order to serve the catalog:

```bash
$ npm run build
```

To run the catalog in developer mode:

```bash
$ npm start
```

This uses `webpack` under the hood to compile code changes on the fly and provide live reloading, useful when developing.

Make sure that any images you check into the repository are [optimized](https://kinsta.com/blog/optimize-images-for-web/) at check-in time.

### Testing

To run the catalog unit tests:

```bash
npm run test
```

## Creating a release

1. Once you are ready to cut a new release of your project, you update the version in `setup.py` and create a new git tag with `git tag $VERSION`.
2. Once you push the tag to GitHub with `git push --tags` a new CircleCI build is triggered.
3. Merge the new PR into master so the `setup.py` reflects the latest package.

## Updating documentation

Documentation is served via GitBook, and is based on the `docs/` folder in the `master` branch of the `t4` repository.

Documentation changes go live at pull request merge time. There is currently no way to preview documentation updates except locally.

### Updating the API Reference

The API Reference section of the documentation is served by processing the docstrings in the codebase using a script. We use [our own fork](https://github.com/quiltdata/pydoc-markdown/tree/quilt) of the `pydoc-markdown` package to do the necessary work.

To modify the API Reference, modify the docstring associated with a method of interest.

Then, run the following to install the latest version of our docstring parser:

```bash
pip install git+git://github.com/quiltdata/pydoc-markdown.git@quilt
```

Then navigate to the `gendocs` directory and execute `python build.py`.

The resulting files will land in `docs/` and will be ready to be checked in.

### Updating everything else

All other pages in the documentation are served from corresponding Markdown pages in the `docs` directory. To edit the page, edit the Markdown file. Then check that file in.

## License

Quilt is open source under the [Apache License, Version 2.0](https://github.com/quiltdata/quilt/tree/7a4a6db12839e2b932847db5224b858da52db200/LICENSE/README.md).
