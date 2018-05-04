/* App */
import { fromJS } from 'immutable';
import React from 'react';
import { Switch, Route } from 'react-router-dom';

import CoreLF from 'components/CoreLF';
import Footer from 'components/Footer';
import { Pad } from 'components/LayoutHelpers';
import Redirect from 'components/Redirect';
import AuthBar from 'containers/AuthBar';
import HomePage from 'containers/HomePage/Loadable';
import LogIn from 'components/LogIn'
import NotFoundPage from 'containers/NotFoundPage/Loadable';
import Notifications from 'containers/Notifications';
import OAuth2 from 'containers/OAuth2/Loadable';
import Package from 'containers/Package/Loadable';
import Profile from 'containers/Profile/Loadable';
import SearchResults from 'containers/SearchResults/Loadable';
import SignOut from 'containers/SignOut';
import User from 'containers/User/Loadable';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';
import { composeComponent } from 'utils/reactTools';
import requireAuth from 'utils/requireAuth';
import { loadState } from 'utils/storage';

import config from 'constants/config';

import { REDUX_KEY } from './constants';
import reducer from './reducer';
import saga from './saga';

const requireAuthIfTeam = (Component) =>
  config.team && config.alwaysRequiresAuth
    ? requireAuth(Component) : Component;

const grnaUrl = 'https://blog.quiltdata.com/designing-crispr-sgrnas-in-python-cd693674237d';

const ProtectedHome = requireAuthIfTeam(HomePage);
const ProtectedPackage = requireAuthIfTeam(Package);
const ProtectedUser = requireAuthIfTeam(User);
const ProtectedProfile = requireAuth(Profile);
const ProtectedSearch = requireAuthIfTeam(SearchResults);
const ProtectedNotFound = requireAuthIfTeam(NotFoundPage);

export default composeComponent('App',
  injectReducer(REDUX_KEY, reducer, () => {
    const { RESPONSE, TOKENS } = loadState();
    return fromJS({ user: { auth: { response: RESPONSE, tokens: TOKENS } } });
  }),
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
          <Route path="/oauth_callback" exact component={OAuth2} />
          <Route path="/grna-search" exact render={() => <Redirect url={grnaUrl} />} />
          <Route path="/profile/:section(admin)?" exact component={ProtectedProfile} />
          <Route path="/search" exact component={ProtectedSearch} />
          <Route path="/signout" exact component={SignOut} />
          <Route path="/login" exact component={LogIn} />
          <Route path="" component={ProtectedNotFound} />
        </Switch>
      </Pad>
      <Footer />
      <Notifications />
    </CoreLF>
  ));
