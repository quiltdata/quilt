/* SearchResults */
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';
import { connect } from 'react-redux';
import { FormattedMessage } from 'react-intl';
import { createStructuredSelector } from 'reselect';

import apiStatus from 'constants/api';
import Error from 'components/Error';
import Gallery from 'containers/Gallery';
import Help from 'components/Help';
import PackageList from 'components/PackageList';
import Working from 'components/Working';

import messages from './messages';
import { makeSelectSearch } from './selectors';

export class SearchResults extends React.PureComponent { // eslint-disable-line react/prefer-stateless-function
  render() {
    const {
      router: { push },
      search: {
        error,
        status,
        response = { packages: [] },
      },
    } = this.props;

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
}

SearchResults.propTypes = {
  dispatch: PropTypes.func.isRequired,
  router: PropTypes.object.isRequired,
  search: PropTypes.object.isRequired,
};

function mapDispatchToProps(dispatch) {
  return {
    dispatch,
  };
}

const mapStateToProps = createStructuredSelector({
  search: makeSelectSearch(),
});

export default connect(mapStateToProps, mapDispatchToProps)(SearchResults);
