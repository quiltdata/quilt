/* App */
import id from 'lodash/identity';
import React from 'react';
import { Switch, Route } from 'react-router-dom';

import CoreLF from 'components/CoreLF';
import Footer from 'components/Footer';
import { Pad } from 'components/LayoutHelpers';
import Redirect from 'components/Redirect';
// TODO: use loadable?
import {
  SignIn,
  SignOut,
  SignUp,
  PassReset,
  PassChange,
  Code,
  requireAuth,
} from 'containers/Auth';
import AuthBar from 'containers/AuthBar';
import HomePage from 'containers/HomePage/Loadable';
import NotFoundPage from 'containers/NotFoundPage/Loadable';
import Notifications from 'containers/Notifications';
import Package from 'containers/Package/Loadable';
import Profile from 'containers/Profile/Loadable';
import SearchResults from 'containers/SearchResults/Loadable';
import User from 'containers/User/Loadable';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';
import { composeComponent } from 'utils/reactTools';

import config from 'constants/config';

import { REDUX_KEY } from './constants';
import reducer from './reducer';
import saga from './saga';

const requireAuthIfConfigured = config.alwaysRequiresAuth ? requireAuth : id;

const grnaUrl = 'https://blog.quiltdata.com/designing-crispr-sgrnas-in-python-cd693674237d';

const ProtectedHome = requireAuthIfConfigured(HomePage);
const ProtectedPackage = requireAuthIfConfigured(Package);
const ProtectedUser = requireAuthIfConfigured(User);
const ProtectedProfile = requireAuth(Profile);
const ProtectedSearch = requireAuthIfConfigured(SearchResults);
const ProtectedNotFound = requireAuthIfConfigured(NotFoundPage);
const ProtectedCode = requireAuth(Code);

export default composeComponent('App',
  injectReducer(REDUX_KEY, reducer),
  injectSaga(REDUX_KEY, saga),
  () => (
    <CoreLF>
      <AuthBar />
      <Pad top left right bottom>
        <Switch>
          <Route path="/" exact component={ProtectedHome} />
          <Route path="/package/:owner/:name" exact component={ProtectedPackage} />
          <Route path="/package/:username" exact component={ProtectedUser} />
          <Route path="/user/:username" exact component={ProtectedUser} />
          <Route path="/grna-search" exact render={() => <Redirect url={grnaUrl} />} />
          <Route path="/profile/:section(admin)?" exact component={ProtectedProfile} />
          <Route path="/search" exact component={ProtectedSearch} />

          <Route path="/code" exact component={ProtectedCode} />

          <Route path="/signin" exact component={SignIn} />
          <Route path="/signup" exact component={SignUp} />
          <Route path="/signout" exact component={SignOut} />
          <Route path="/reset_password" exact component={PassReset} />
          <Route path="/reset_password/:link" exact component={PassChange} />

          <Route path="" component={ProtectedNotFound} />
        </Switch>
      </Pad>
      <Footer />
      <Notifications />
    </CoreLF>
  ));
