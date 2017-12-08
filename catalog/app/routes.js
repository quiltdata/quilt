// These are the pages you can go to.
// They are all wrapped in the App component, which should contain the navbar etc
// See http://blog.mxstbr.com/2016/01/react-apps-with-pages for more information
// about the code splitting business
import { getAsyncInjectors } from 'utils/asyncInjectors';

import queryString from 'query-string';

const errorLoading = (err) => {
  console.error('Dynamic page loading failed', err); // eslint-disable-line no-console
};

const loadModule = (cb) => (componentModule) => {
  cb(null, componentModule.default);
};

export default function createRoutes(store) {
  // Create reusable async injectors using getAsyncInjectors factory
  const { injectReducer, injectSagas } = getAsyncInjectors(store); // eslint-disable-line no-unused-vars

  return [
    {
      path: '/',
      name: 'home',
      getComponent(nextState, cb) {
        const importModules = Promise.all([
          import('containers/HomePage'),
        ]);

        const renderRoute = loadModule(cb);

        importModules.then(([component]) => {
          renderRoute(component);
        });

        importModules.catch(errorLoading);
      },
    }, {
      path: '/package/:owner/:name',
      name: 'package',
      getComponent(location, cb) {
        import('containers/Package')
          .then(loadModule(cb))
          .catch(errorLoading);
      },
    }, {
      path: '/oauth_callback',
      name: 'oauth2',
      onEnter: (props, replaceState) => {
        if (props.location.hash) {
          const parsedHash = queryString.parse(props.location.hash);
          const newQuery = Object.assign({}, props.location.query, parsedHash);
          replaceState({
            pathname: props.location.pathname,
            query: newQuery,
          });
        }
      },
      getComponent(nextState, cb) {
        const importModules = Promise.all([
          import('containers/OAuth2'),
        ]);

        const renderRoute = loadModule(cb);

        importModules.then(([component]) => {
          renderRoute(component);
        });

        importModules.catch(errorLoading);
      },
    }, {
      path: '/grna-search',
      name: 'redirect',
      getComponent(location, cb) {
        import('components/Redirect')
          .then(loadModule(cb))
          .catch(errorLoading);
      },
    }, {
      path: '/profile',
      name: 'profile',
      getComponent(nextState, cb) {
        const importModules = Promise.all([
          import('containers/Profile/reducer'),
          import('containers/Profile/sagas'),
          import('containers/Profile'),
        ]);

        const renderRoute = loadModule(cb);

        importModules.then(([reducer, sagas, component]) => {
          injectReducer('profile', reducer.default);
          injectSagas(sagas.default);
          renderRoute(component);
        });

        importModules.catch(errorLoading);
      },
    }, {
      path: '/search',
      name: 'searchResults',
      getComponent(nextState, cb) {
        import('containers/SearchResults')
          .then(loadModule(cb))
          .catch(errorLoading);
      },
    }, {
      path: '*',
      name: 'notfound',
      getComponent(nextState, cb) {
        import('containers/NotFoundPage')
          .then(loadModule(cb))
          .catch(errorLoading);
      },
    },
  ];
}
