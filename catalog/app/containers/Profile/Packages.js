import Avatar from 'material-ui/Avatar';
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage } from 'react-intl';
import { setPropTypes } from 'recompose';

import Help from 'components/Help';
import PackageList from 'components/PackageList';
import config from 'constants/config';
import { makePackage } from 'constants/urls';
import { composeComponent } from 'utils/reactTools';

import messages from './messages';

export default composeComponent('Profile.Packages',
  setPropTypes({
    packages: PropTypes.object,
    push: PropTypes.func.isRequired,
    shortName: PropTypes.string,
    user: PropTypes.string,
  }),
  ({
    packages,
    push, // eslint-disable-line no-shadow
    shortName,
    user,
  }) => (
    <Fragment>
      <h1><Avatar>{shortName}</Avatar> {user}</h1>
      <h2><FormattedMessage {...messages.own} /></h2>
      <PackageList
        push={push}
        emptyMessage={<FormattedMessage {...messages.noOwned} />}
        emptyHref={makePackage}
        packages={packages.own}
        showPrefix={false}
      />
      <h2><FormattedMessage {...messages.shared} /></h2>
      <PackageList push={push} packages={packages.shared} />
      <h2><FormattedMessage {...messages[config.team ? 'team' : 'public']} /></h2>
      <Help to="/search/?q=">
        <FormattedMessage {...messages.showPublic} />
      </Help>
    </Fragment>
  ));
