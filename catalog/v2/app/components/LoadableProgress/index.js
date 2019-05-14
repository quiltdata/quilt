import PT from 'prop-types';
import React from 'react';
import { setPropTypes } from 'recompose';

import Working from 'components/Working';
import { composeComponent } from 'utils/reactTools';


export default composeComponent('LoadableProgress',
  setPropTypes({
    error: PT.any,
    pastDelay: PT.bool,
  }),
  ({ error, pastDelay }) => {
    if (error) {
      return <div>Error loading component!</div>;
    }
    if (pastDelay) {
      return <Working />;
    }
    return null;
  });
