# Quilt catalog
The catalog is a web frontend for browsing meta-data held by the Quilt registry.

# Developer
## Configuration
The app configuration (API endpoints, Stripe keys, etc.) is stored in the [environment](https://12factor.net/config),
served at the `/config.js` endpoint (populated using `config.js.tmpl` as a template)
and exposed to the app as the `window.__CONFIG` object.

### Production environment
The template is processed by `envsubst` and served by `nginx` (see `Dockerfile`).
To create a static config file with the given settings, use `npm run config $ENV_FILE`,
where `$ENV_FILE` is an env-file with the required settings (see `.env.example` for details).

### Development environment
The template is processed and served by the custom middleware (`server/middleware/config.js`).
Overriding env vars via `.env` file is supported, see `.env.example` for details.
All the variables mentioned in the template **must** be present in the environment / `.env` file,
otherwise exception is raised.

## Running the catalog locally
```sh
$ cd registry
# Docker minus catalog
$ docker-compose -f docker-compose-uidev.yml up
# local web server for catalog w/hot reload
$ cd ../catalog
# copy and edit config file (see comments there for details)
$ cp .env.example .env
$ vi .env
$ npm start 
```

### Update docker images as backend components evolve
* `docker-compose build [catalog|flask|auth|etc.]`
* `docker-compose pull django`
* `docker build -t quiltdata/django .` (in django repo)

## Common operations
* `npm run lint` to lint
* You can [customize ES6-lint behavior](http://eslint.org/docs/user-guide/configuring)
* `// eslint-disable-line <ERROR-CODE>`

## Notes
- As a rule all UI component classes should return react-bootstrap `Row`s;
  this prevents layout contamination (e.g. returning a Col that accidentally
  flows in with another `Col`) and allows for high-level layout control
  through classes like `LayoutHelpers`.

- `npm run generate` to create new routes, components, containers, languages
  - see also [react-boilerplate notes on routes](https://github.com/react-boilerplate/react-boilerplate/blob/master/docs/js/routing.md)

- don't be surprised if react-boilerplate code and doc gets way ahead of our repo;
it's rapidly evolving and there isn't a good way to pick up changes

- Redux store.app is generally populated with Immutable.js data structures, whereas
selectors mostly return JS (use Immutable.toJS()) for consumption by React components.
React-redux also seems to rely on JS data structures for `routingState` and `LOCATION_CHANGE`,
but that's handled in a separate domain (`state.route`) via reducer composition;
  - makeSelectorNAME converts to JS for mapping to props
  - leaf nodes may be primitive types
  - use toJS() and fromJS from 'immutable' to convert

### Connecting to the router
- all route handling components already get a bunch of params injected as props
- for everything else: [`withRouter`](https://github.com/ReactTraining/react-router/blob/c3cd9675bd8a31368f87da74ac588981cbd6eae7/upgrade-guides/v2.4.0.#d)

### Fetch
- An accurate check for a successful fetch() would include checking that the promise resolved, then checking that the Response.ok property has a value of true. The code would look something like this:
[msdn fetch doc](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
