/* app.js - application entry point */
// Needed for redux-saga es6 generator support
import 'babel-polyfill';

// Import all the third party stuff
import Raven from 'raven-js';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyRouterMiddleware, Router, browserHistory } from 'react-router';
import { syncHistoryWithStore } from 'react-router-redux';
import FontFaceObserver from 'fontfaceobserver';
import { useScroll } from 'react-router-scroll';
import 'sanitize.css/sanitize.css';
//  Need to bypass CSS modules used by standard loader
//  See https://github.com/react-boilerplate/react-boilerplate/issues/238#issuecomment-222080327
import '!!style-loader!css-loader!css/bootstrap-grid.css';

// Import root app
import App from 'containers/App';
// Import selector for `syncHistoryWithStore`
import { makeSelectLocationState } from 'containers/App/selectors';
// Import Language Provider
import LanguageProvider from 'containers/LanguageProvider';
// Load the favicon, the manifest.json file and the .htaccess file
/* eslint-disable import/no-unresolved, import/extensions */
import '!file-loader?name=[name].[ext]!./favicon.ico';
import '!file-loader?name=[name].[ext]!./manifest.json';
import '!file-loader?name=[name].[ext]!./quilt-og.png';
import 'file-loader?name=[name].[ext]!./.htaccess';
/* eslint-enable import/no-unresolved, import/extensions */
import configureStore from './store';
// Import i18n messages
import { translationMessages } from './i18n';
// Import CSS reset and Global Styles
import './global-styles';
// Import root routes
import createRoutes from './routes';

Raven
  .config('https://e0c7810a7a0b4ce898d6e78c1b63f52d@sentry.io/300712')
  .install();

Raven.context(() => {
  // listen for Roboto fonts
  const robo = new FontFaceObserver('Roboto', {});
  const roboMono = new FontFaceObserver('Roboto Mono', {});
  const roboSlab = new FontFaceObserver('Roboto Slab', {});
  // reload doc when we have all custom fonts
  Promise.all([robo.load(), roboSlab.load(), roboMono.load()]).then(() => {
    document.body.classList.add('fontLoaded');
  });


  // Create redux store with history
  // this uses the singleton browserHistory provided by react-router
  // Optionally, this could be changed to leverage a created history
  // e.g. `const browserHistory = useRouterHistory(createBrowserHistory)();`
  const initialState = {};
  const store = configureStore(initialState, browserHistory);

  // Sync history and store, as the react-router-redux reducer
  // is under the non-default key ("routing"), selectLocationState
  // must be provided for resolving how to retrieve the "route" in the state
  const history = syncHistoryWithStore(browserHistory, store, {
    selectLocationState: makeSelectLocationState(),
  });

  // Set up the router, wrapping all Routes in the App component
  const rootRoute = {
    component: App,
    childRoutes: createRoutes(store),
  };

  // TODO: this does not work when element has yet to load
  const hashScroll = (prev, { location }) => {
    const { hash } = location;
    if (hash) {
      const elt = document.querySelector(hash);
      if (elt) {
        elt.scrollIntoView();
        return false;
      }
    }
    return true;
  };

  const render = (messages) => {
    ReactDOM.render(
      <Provider store={store}>
        <LanguageProvider messages={messages}>
          <Router
            history={history}
            routes={rootRoute}
            render={
              // Scroll to top when going to a new page, imitating default browser
              // behaviour
              applyRouterMiddleware(useScroll(hashScroll))
            }
          />
        </LanguageProvider>
      </Provider>,
      document.getElementById('app')
    );
  };

  // Hot reloadable translation json files
  if (module.hot) {
    // modules.hot.accept does not accept dynamic dependencies,
    // have to be constants at compile-time
    module.hot.accept('./i18n', () => {
      render(translationMessages);
    });
  }

  // Chunked polyfill for browsers without Intl support
  if (!window.Intl) {
    (new Promise((resolve) => {
      resolve(import('intl'));
    }))
      .then(() => Promise.all([
        import('intl/locale-data/jsonp/en.js'),
      ]))
      .then(() => render(translationMessages))
      .catch((err) => {
        throw err;
      });
  } else {
    render(translationMessages);
  }

  // Delete the old service worker.
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => { registration.unregister(); });
    });
  }
});
