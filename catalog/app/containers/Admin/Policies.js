import Checkbox from 'material-ui/Checkbox';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage as FM } from 'react-intl';
import {
  compose,
  setDisplayName,
  setPropTypes,
} from 'recompose';

import msg from './messages';

export default compose(
  setPropTypes({
    read: PT.bool.isRequired,
    write: PT.bool.isRequired,
    onReadCheck: PT.func.isRequired,
    onWriteCheck: PT.func.isRequired,
  }),
  setDisplayName('Admin.Policies'),
// eslint-disable-next-line object-curly-newline
)(({ read, write, onReadCheck, onWriteCheck }) => (
  <Fragment>
    <h2><FM {...msg.teamPolicies} /></h2>
    <Checkbox
      checked={read}
      disabled
      label={<FM {...msg.membersRead} />}
      onCheck={onReadCheck}
    />
    <Checkbox
      checked={write}
      disabled
      label={<FM {...msg.membersWrite} />}
      onCheck={onWriteCheck}
    />
  </Fragment>
));
