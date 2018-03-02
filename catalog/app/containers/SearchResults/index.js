/* SearchResults */
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';
import { connect } from 'react-redux';
import { setPropTypes } from 'recompose';
import { FormattedMessage } from 'react-intl';
import { createStructuredSelector } from 'reselect';

import apiStatus from 'constants/api';
import Error from 'components/Error';
import Gallery from 'containers/Gallery';
import Help from 'components/Help';
import PackageList from 'components/PackageList';
import Working from 'components/Working';
import { composeComponent } from 'utils/reactTools';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';

import { REDUX_KEY } from './constants';
import messages from './messages';
import reducer from './reducer';
import saga from './saga';
import { makeSelectSearch } from './selectors';

// TODO: get query from location / router, dispatch getSearch()
export default composeComponent('SearchResults',
  injectSaga(REDUX_KEY, saga),
  injectReducer(REDUX_KEY, reducer),
  connect(createStructuredSelector({ search: makeSelectSearch() })),
  setPropTypes({
    dispatch: PropTypes.func.isRequired,
    router: PropTypes.object.isRequired,
    search: PropTypes.object.isRequired,
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
        <Help href="/search/?q=">
          Browse all packages
        </Help>
        <br />
        {
          response.packages.length === 0 ? null : (
            <Fragment>
              <h1>New packages</h1>
              <Gallery />
            </Fragment>
          )
        }
        <br />
      </div>
    );
  }
);
