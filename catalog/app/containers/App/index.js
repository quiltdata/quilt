/* App */
import { fromJS } from 'immutable';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { compose } from 'recompose';
import { createStructuredSelector } from 'reselect';

import AuthBar from 'components/AuthBar';
import status from 'constants/api';
import CoreLF from 'components/CoreLF';
import Footer from 'components/Footer';
import { Pad } from 'components/LayoutHelpers';
import Notifications from 'containers/Notifications';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';
import { loadState } from 'utils/storage';

import { routerStart } from './actions';
import { REDUX_KEY } from './constants';
import reducer from './reducer';
import saga from './saga';
import {
  makeSelectAuth,
  makeSelectSearchText,
  makeSelectSignedIn,
  makeSelectUserName,
} from './selectors';

export class App extends React.PureComponent { // eslint-disable-line react/prefer-stateless-function
  componentWillMount() {
    const { dispatch } = this.props;
    const { pathname, search } = window.location;
    // we need to fire on first mount since react-router-redux does not fire
    // a location change on first entry into a route (e.g. cold JS start or
    // hard link)
    dispatch(routerStart({ pathname, search }));
  }

  render() {
    // eslint-disable-next-line object-curly-newline
    const { auth, children, dispatch, name, searchText, signedIn } = this.props;
    const waiting = auth.status === status.WAITING;
    return (
      <CoreLF>
        <AuthBar
          dispatch={dispatch}
          error={auth.error}
          signedIn={signedIn}
          name={name}
          searchText={searchText}
          waiting={waiting}
        />
        <Pad top left right bottom>
          { children }
        </Pad>
        <Footer />
        <Notifications />
      </CoreLF>
    );
  }
}

App.propTypes = {
  auth: PropTypes.object,
  children: PropTypes.node,
  dispatch: PropTypes.func.isRequired,
  searchText: PropTypes.string,
  signedIn: PropTypes.bool,
  name: PropTypes.string,
};

const mapStateToProps = createStructuredSelector({
  auth: makeSelectAuth(),
  searchText: makeSelectSearchText(),
  signedIn: makeSelectSignedIn(),
  name: makeSelectUserName(),
});

function mapDispatchToProps(dispatch) {
  return {
    dispatch,
  };
}

export default compose(
  injectReducer(REDUX_KEY, reducer, () => {
    const { RESPONSE, TOKENS } = loadState();
    return fromJS({ user: { auth: { response: RESPONSE, tokens: TOKENS } } });
  }),
  injectSaga(REDUX_KEY, saga),
  connect(mapStateToProps, mapDispatchToProps),
)(App);
