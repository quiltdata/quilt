import React from 'react';
import {
  compose,
  lifecycle,
  setDisplayName,
} from 'recompose';
import { createStructuredSelector } from 'reselect';
import { connect } from 'react-redux';
import { FormattedMessage as FM } from 'react-intl';
import Avatar from 'material-ui/Avatar';

import apiStatus from 'constants/api';
import Error from 'components/Error';
import PackageList from 'components/PackageList';
import Working from 'components/Working';
import { makeSelectUserName } from 'containers/App/selectors';

import { getPackages } from './actions';
import messages from './messages';
import { makeSelectPackages } from './selectors';


const getShortName = (name) => name.slice(0, 2).toUpperCase();

export default compose(
  connect(
    createStructuredSelector({
      packages: makeSelectPackages(),
      user: makeSelectUserName(),
    }),
    { getPackages }
  ),
  lifecycle({
    componentWillMount() {
      this.props.getPackages(this.props.params.username);
    },
    componentWillReceiveProps(nextProps) {
      const { params: { username }, user } = this.props;
      const { params: { username: newUsername }, user: newUser } = nextProps;
      // refetch packages if
      // 1. username has changed (obvious)
      // 2. current signed-in user has changed (due to visibility / permissions)
      if (username !== newUsername || user !== newUser) {
        this.props.getPackages(username);
      }
    },
  }),
  setDisplayName('User'),
)(({
  packages: { status, response },
  params: { username },
  router: { push },
}) =>
  status === apiStatus.ERROR ? <Error {...response} /> : (
    <div>
      <h1><Avatar>{getShortName(username)}</Avatar> {username}</h1>
      <h2><FM {...messages.owned} values={{ username }} /></h2>
      {status !== apiStatus.SUCCESS ? <Working /> : (
        <PackageList
          packages={response.packages}
          push={push}
          owner={username}
          showOwner={false}
        />
      )}
    </div>
  )
); // eslint-disable-line function-paren-newline
