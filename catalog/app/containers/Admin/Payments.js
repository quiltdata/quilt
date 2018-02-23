import PT from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage as FM } from 'react-intl';

import MIcon from 'components/MIcon';

import {
  compose,
  setDisplayName,
  setPropTypes,
} from 'recompose';

import msg from './messages';

export default compose(
  setPropTypes({
  }),
  setDisplayName('Admin.Payments'),
// eslint-disable-next-line object-curly-newline
)(() => (
  <Fragment>
    <h2><FM {...msg.teamPayment} /></h2>
    <MIcon>undefined</MIcon>
  </Fragment>
));
