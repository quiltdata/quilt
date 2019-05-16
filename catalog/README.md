# Quilt catalog
The catalog is a web frontend for browsing meta-data held by the Quilt registry.

# Developer
## Configuration
The app configuration (API endpoints, bucket federations, etc.) is read from
the `/config.json` path.

## Running the catalog locally
```sh
# local web server for catalog w/hot reload
$ cd catalog
# copy and edit config file
$ cp config.json.example static-dev/config.json
$ vi static-dev/config.json
# copy and edit federation file if required
$ cp federation.json.example static-dev/federation.json
$ vi static-dev/federation.json
$ npm start
```

## Notes
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
