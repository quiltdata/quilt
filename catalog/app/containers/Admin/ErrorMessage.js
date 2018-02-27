import PT from 'prop-types';
import React from 'react';
import { injectIntl } from 'react-intl';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import msg from './messages';

export default compose(
  injectIntl,
  setPropTypes({
    error: PT.shape({
      message: PT.string,
    }).isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  setDisplayName('Admin.ErrorMessage'),
)(({ error, intl: { formatMessage } }) => (
  <p>{error.message || formatMessage(msg.defaultErrorMessage)}</p>
));
