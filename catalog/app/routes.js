// These are the pages you can go to.
// They are all wrapped in the App component, which should contain the navbar etc
// See http://blog.mxstbr.com/2016/01/react-apps-with-pages for more information
// about the code splitting business
import queryString from 'query-string';
import { withProps } from 'recompose';
import requireAuth from 'utils/requireAuth';
import config from 'constants/config';

import Redirect from 'components/Redirect';
import HomePage from 'containers/HomePage/Loadable';
import NotFoundPage from 'containers/NotFoundPage/Loadable';
import OAuth2 from 'containers/OAuth2/Loadable';
import Package from 'containers/Package/Loadable';
import Profile from 'containers/Profile/Loadable';
import SearchResults from 'containers/SearchResults/Loadable';
import SignOut from 'containers/SignOut';
import User from 'containers/User/Loadable';


const requireAuthIfTeam = (Component) =>
  config.team && config.alwaysRequiresAuth
    ? requireAuth(Component) : Component;

const grnaUrl = 'https://blog.quiltdata.com/designing-crispr-sgrnas-in-python-cd693674237d';


export default [
  {
    path: '/',
    name: 'home',
    component: requireAuthIfTeam(HomePage),
  }, {
    path: '/package/:owner/:name',
    name: 'package',
    component: requireAuthIfTeam(Package),
  }, {
    path: '/user/:username',
    name: 'user',
    component: requireAuthIfTeam(User),
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
    component: OAuth2,
  }, {
    path: '/grna-search',
    name: 'redirect',
    component: withProps({ url: grnaUrl })(Redirect),
  }, {
    path: '/profile',
    name: 'profile',
    component: requireAuth(Profile),
  }, {
    path: '/search',
    name: 'searchResults',
    component: requireAuthIfTeam(SearchResults),
  }, {
    path: '/signout',
    name: 'signout',
    component: SignOut,
  }, {
    path: '*',
    name: 'notfound',
    component: requireAuthIfTeam(NotFoundPage),
  },
];
