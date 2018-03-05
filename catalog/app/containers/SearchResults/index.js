/* SearchResults */
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';
import { connect } from 'react-redux';
import { lifecycle, setPropTypes } from 'recompose';
import { FormattedMessage } from 'react-intl';
import { createStructuredSelector } from 'reselect';

import apiStatus from 'constants/api';
import Error from 'components/Error';
import Gallery from 'containers/Gallery';
import Help from 'components/Help';
import PackageList from 'components/PackageList';
import Working from 'components/Working';
import { setSearchText } from 'containers/App/actions';
import { makeSelectSearchText } from 'containers/App/selectors';
import { composeComponent } from 'utils/reactTools';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';

import { getSearch } from './actions';
import { REDUX_KEY } from './constants';
import messages from './messages';
import reducer from './reducer';
import saga from './saga';
import { makeSelectSearch } from './selectors';

export default composeComponent('SearchResults',
  injectReducer(REDUX_KEY, reducer),
  injectSaga(REDUX_KEY, saga),
  connect(createStructuredSelector({
    search: makeSelectSearch(),
    searchText: makeSelectSearchText(),
  })),
  setPropTypes({
    dispatch: PropTypes.func.isRequired,
    router: PropTypes.object.isRequired,
    location: PropTypes.shape({
      query: PropTypes.object.isRequired,
    }).isRequired,
    search: PropTypes.object.isRequired,
    searchText: PropTypes.string.isRequired,
  }),
  lifecycle({
    componentWillMount() {
      const {
        location: { query: { q } },
        searchText,
        dispatch,
      } = this.props;
      if (q !== searchText) dispatch(setSearchText(q));
      dispatch(getSearch(q));
    },
    componentWillReceiveProps({ dispatch, searchText, location: { query: { q } } }) {
      const oldQ = this.props.location.query.q;
      if (q !== oldQ) {
        dispatch(getSearch(q));
        if (q !== searchText) dispatch(setSearchText(q));
      }
    },
    componentWillUnmount() {
      this.props.dispatch(setSearchText(''));
    },
  }),
  ({
    router: { push },
    search: {
      error,
      status,
      response = { packages: [] },
    },
  }) => {
    switch (status) {
      case undefined:
      case apiStatus.WAITING:
        return <Working><FormattedMessage {...messages.header} /></Working>;
      case apiStatus.ERROR:
        return <Error {...error} />;
      default:
        break;
    }
    return (
      <div>
        <h1><FormattedMessage {...messages.header} /></h1>
        <PackageList
          emptyMessage={<FormattedMessage {...messages.empty} />}
          packages={response.packages}
          push={push}
        />
        <br />
        <Help to="/search/?q=">Browse all packages</Help>
        <br />
        {response.packages.length === 0 ? null : (
          <Fragment>
            <h1>New packages</h1>
            <Gallery />
          </Fragment>
        )}
        <br />
      </div>
    );
  });
