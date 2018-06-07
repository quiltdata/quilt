/* app.js - application entry point */
// Needed for redux-saga es6 generator support
import 'babel-polyfill';

// Import all the third party stuff
import React from 'react';
import ReactDOM from 'react-dom';
import { LOCATION_CHANGE } from 'react-router-redux';
import FontFaceObserver from 'fontfaceobserver';
import createHistory from 'history/createBrowserHistory';
import { reducer as form } from 'redux-form/immutable';
import { LOCATION_CHANGE } from 'react-router-redux';
import 'sanitize.css/sanitize.css';
//  Need to bypass CSS modules used by standard loader
//  See https://github.com/react-boilerplate/react-boilerplate/issues/238#issuecomment-222080327
import '!!style-loader!css-loader!css/bootstrap-grid.css';

// Import root app
import App from 'containers/App';
import { makeSelectUserName } from 'containers/App/selectors';
import { ROUTER_START } from 'containers/App/constants';
import config from 'constants/config';
// Import Language Provider
import LanguageProvider from 'containers/LanguageProvider';
import AuthProvider from 'containers/Auth/Provider';
import config from 'constants/config';
import { InjectReducer } from 'utils/ReducerInjector';
import RouterProvider from 'utils/router';
import * as storage from 'utils/storage';
import StoreProvider from 'utils/StoreProvider';
import tracking from 'utils/tracking';
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

// TODO: factor-out font loading logic
// listen for Roboto fonts
const robo = new FontFaceObserver('Roboto', {});
const roboMono = new FontFaceObserver('Roboto Mono', {});
// reload doc when we have all custom fonts
Promise.all([robo.load(), roboMono.load()]).then(() => {
  document.body.classList.add('fontLoaded');
});

// Create redux store with history
const initialState = {};
const history = createHistory();
const store = configureStore(initialState, history);
const MOUNT_NODE = document.getElementById('app');

// Check auth when location changes.
const checkAuthOn = LOCATION_CHANGE;

const render = (messages) => {
  ReactDOM.render(
    <StoreProvider store={store}>
      <InjectReducer mount="form" reducer={form}>
        <LanguageProvider messages={messages}>
          <AuthProvider
            checkOn={checkAuthOn}
            storage={storage}
            api={config.api}
            signInRedirect="/profile"
          >
            <RouterProvider history={history}>
              <App />
            </RouterProvider>
          </AuthProvider>
        </LanguageProvider>
      </InjectReducer>
    </StoreProvider>,
    MOUNT_NODE
  );
};

// track navigation
store.runSaga(tracking, {
  selectUsername: makeSelectUserName(),
  locationChangeAction: LOCATION_CHANGE,
  routerStartAction: ROUTER_START,
  token: config.mixpanelToken,
});

if (module.hot) {
  // Hot reloadable React components and translation json files
  // modules.hot.accept does not accept dynamic dependencies,
  // have to be constants at compile-time
  module.hot.accept(['./i18n', 'containers/App'], () => {
    ReactDOM.unmountComponentAtNode(MOUNT_NODE);
    render(translationMessages);
  });
}

// Chunked polyfill for browsers without Intl support
if (!window.Intl) {
  import('intl')
    .then(() => Promise.all([
      import('intl/locale-data/jsonp/en.js'),
    ]))
    .then(() => render(translationMessages));
} else {
  render(translationMessages);
}

// Delete the old service worker.
if (navigator.serviceWorker) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => { registration.unregister(); });
  });
}
