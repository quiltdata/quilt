/* App */
import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';

import AuthBar from 'components/AuthBar';
import status from 'constants/api';
import CoreLF from 'components/CoreLF';
import Footer from 'components/Footer';
import { Pad } from 'components/LayoutHelpers';

import { routerStart } from './actions';
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

export default connect(mapStateToProps, mapDispatchToProps)(App);
