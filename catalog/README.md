# Environments
- stage https://packages-stage.firebaseapp.com/
- production https://packages-c0c70.firebaseapp.com or beta.quiltdata.com

# Development
1. `npm start` to fire up a local web server (or `npm run start:production`)
1. `npm run lint` to lint
    - You can [customize ES6-lint behavior](http://eslint.org/docs/user-guide/configuring)
    - // es-line-disable-line error-code

# Deployment
1. `npm run build` = code splitting, name mangling, asset minification, etc.
  - Most of the magic happens in `app.js`
  - Occassionally (e.g. you need a new importer) you may need to look into
`internals/webpack/webpack.base.babe.js`. See also [Where is webpack.config.js]
(https://github.com/react-boilerplate/react-boilerplate/issues/407)
1. `firebase use ALIAS` (select project)
1. `firebase deploy` = place assets (from `/buid/`) on CDN

# TODO
* add Sentry error logging
* analytics see [history notes](https://github.com/react-boilerplate/react-boilerplate/blob/8407cf05c4f1d43ca6c78625b7b8fee7627fdedb/docs/general/introduction.md#appappjs)
* meta tags for SEO (helmet?)
* OG tags on home and package pages for thumbnailing

# Developer notes
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

## Connecting to the router
- all route handling components already get a bunch of params injected as props
- for everything else: [`withRouter`](https://github.com/ReactTraining/react-router/blob/c3cd9675bd8a31368f87da74ac588981cbd6eae7/upgrade-guides/v2.4.0.md)

## Fetch
- An accurate check for a successful fetch() would include checking that the promise resolved, then checking that the Response.ok property has a value of true. The code would look something like this:
[msdn fetch doc](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
