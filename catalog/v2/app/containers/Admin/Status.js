import { red300 as warnColor } from 'material-ui/styles/colors';
import IconButton from 'material-ui/IconButton';
import PT from 'prop-types';
import React from 'react';

import { PLANS } from 'containers/Profile/constants';
import MIcon from 'components/MIcon';

import {
  compose,
  setDisplayName,
  setPropTypes,
} from 'recompose';

export default compose(
  setPropTypes({
    plan: PT.string,
  }),
  setDisplayName('Admin.Payments'),
// eslint-disable-next-line object-curly-newline
)(({ plan }) => {
  let icon;
  let detail;

  if (plan in PLANS) {
    icon = PLANS[plan].statusIcon || 'warning';
    detail = PLANS[plan].statusMessage;
  } else {
    icon = 'warning';
    detail = `Unrecognized Service plan, "${plan}". Please contact support@quiltdata.io.`;
  }

  return (
    <IconButton tooltip={detail}>
      <MIcon color={icon === 'warning' ? warnColor : undefined} drop="4px">
        {icon}
      </MIcon>
    </IconButton>
  );
});
