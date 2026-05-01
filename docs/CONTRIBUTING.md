<!--pytest-codeblocks:skipfile-->
<!-- markdownlint-disable-next-line first-line-h1 -->
Quilt is an open source project, and we welcome contributions from the community.

Contributors must adhere to the [Code of Conduct](https://github.com/quiltdata/quilt/blob/master/docs/CODE_OF_CONDUCT.md).

If you are looking for a quick map of where major components live, start with the
repository [`README.md`](../README.md).

## Reporting issues

Unsure about something? To get support, check out our [Slack community](https://slack.quilt.bio).

Found a bug? File it in our [GitHub issues](https://github.com/quiltdata/quilt/issues).

## Forking and Cloning

Most contributors will not have direct push access to `quiltdata/quilt`.
Use a fork-and-pull-request workflow instead.

1. Fork `https://github.com/quiltdata/quilt` to your own GitHub account.
1. Clone your fork locally.
1. Add the main repository as `upstream`.
1. Create your work branch from the latest `upstream/master`.

```bash
git clone https://github.com/<your-github-user>/quilt
cd quilt
git remote add upstream https://github.com/quiltdata/quilt
git fetch upstream
git checkout -B new-branch-name upstream/master
```

When your branch is ready, push it to your fork and open a pull request from
your fork branch into `quiltdata/quilt`.

```bash
git push -u origin new-branch-name
```

If `git push origin ...` returns `403` against `https://github.com/quiltdata/quilt/`,
your local `origin` is probably pointing at the upstream repository instead of your fork.
Repoint `origin` to your fork, or push to a separate fork remote.

If you already cloned `quiltdata/quilt` directly, one straightforward fix is:

```bash
git remote rename origin upstream
git remote add origin https://github.com/<your-github-user>/quilt
git fetch upstream
git checkout -B new-branch-name upstream/master
```

## Local package development

Choose your area first:

- Python SDK and CLI work: `api/python`
- Web catalog work: `catalog`
- AWS services and background processing: `lambdas`
- Platform and user docs: `docs`

### Python Environment

We use [`uv`](https://github.com/astral-sh/uv) for dependency management.
First, install `uv`:

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or with pip
pip install uv
```

`uv` ensures the environment is properly set up before executing a command,
so you don't have to do anything else.

Run `uv run poe` to see all configured tasks (or refer to `pyproject.toml`).

### Python Testing

All new code contributions are expected to have complete unit test
coverage, and to pass all preexisting tests.

Use `pytest` to test your changes during normal development:

```bash
cd api/python
# Run all tests
uv run poe test

# Run tests verbosely
uv run poe test-verbose

# Run with coverage
uv run poe test-cov

# Run specific test file directly
uv run poe test tests/test_util.py
```

## Local catalog development

Note that, at the current time, it is only possible to run a local
catalog if you already have a catalog deployed to AWS, because the
catalog relies on certain services (namely, AWS Lambda and the AWS
Elasticsearch Service) which cannot be run locally.

### Catalog Environment

Use `npm` to install the catalog dependencies locally:

```bash
cd catalog
npm install
```

For the repo's filesystem-backed LOCAL catalog workflow, use the documented one-shot setup in [`docs/Catalog/LocalMode.md`](Catalog/LocalMode.md):

```bash
cd api/python
uvx --from poethepoet poe catalog-test
```

### Build

To build a static code bundle, as would be necessary in order to serve the catalog:

```bash
npm run build
```

To run the catalog locally, create a development config:

```bash
cp config.js.example static-dev/config.js
# edit static-dev/config.js for your environment
```

To run the catalog in developer mode:

```bash
npm start
```

This uses `webpack` under the hood to compile code changes on the
fly and provide live reloading, useful when developing.

Make sure that any images you check into the repository are
[optimized](https://kinsta.com/blog/optimize-images-for-web/) at
check-in time.

### Catalog Testing

To run the catalog unit tests:

```bash
npm run test
```

## Creating a release

These steps require maintainer access to the main repository.

1. Once you are ready to cut a new release, update the version in `api/python/pyproject.toml`
([`uv version`](https://docs.astral.sh/uv/guides/package/#updating-your-version)
can help with this) and in `docs/CHANGELOG.md`.
1. Create PR with these changes.
1. Once PR is merged, create a tag from commit with merge: `git tag $VERSION $COMMIT_HASH`.
1. Once you push the tag to GitHub with `git push origin $VERSION` a new CI build
that makes PyPI release is triggered.

## Updating documentation

Documentation is served via GitBook, and is based on the `docs/`
folder in the `master` branch of the `quilt` repository.

Documentation changes go live at pull request merge time. There is
currently no way to preview documentation updates except locally.

### Updating the API Reference

The API Reference section of the documentation is served by processing
the docstrings in the codebase using a script. We use [our own
fork](https://github.com/quiltdata/pydoc-markdown/tree/quilt) of
the `pydoc-markdown` package to do the necessary work.

To modify the API Reference, modify the docstring associated with a method of interest.

Then, run `uv run poe gendocs` from the `api/python` directory.

The resulting files will land in `docs/` and will be ready to be checked in.

### Updating everything else

All other pages in the documentation are served from corresponding
Markdown pages in the `docs` directory. To edit the page, edit the
Markdown file. Then check that file in.

## License

Quilt is open source under the [Apache License, Version
2.0](https://github.com/quiltdata/quilt/blob/master/LICENSE).
