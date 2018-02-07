import memoize from 'lodash/memoize';
import { createSelector } from 'reselect';
import { withProps } from 'recompose';
import connectedAuthWrapper from 'redux-auth-wrapper/connectedAuthWrapper';
import { makeSignInURL } from 'utils/auth';
import { makeSelectAuth, makeSelectSignedIn } from 'containers/App/selectors';
import apiStatus from 'constants/api';
import Redirect from 'components/Redirect';
import Working from 'components/Working';


const isWaiting = ({ status }) => status === apiStatus.WAITING;

export default memoize(connectedAuthWrapper({
  authenticatingSelector: createSelector(makeSelectAuth(), isWaiting),
  authenticatedSelector: createSelector(makeSelectSignedIn(), (s) => s),
  AuthenticatingComponent: Working,
  FailureComponent: withProps(() => ({ url: makeSignInURL() }))(Redirect),
  wrapperDisplayName: 'RequireAuth',
}));
