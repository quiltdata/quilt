import mapValues from 'lodash/mapValues';
import omit from 'lodash/omit';
import React from 'react';
import { compose, withHandlers, withProps, withStateHandlers } from 'recompose';

import MIcon from 'components/MIcon';


export const branch = (subj, cases) => subj in cases && cases[subj]();

const toIcon = {
  packages: 'cloud_upload',
  previews: 'remove_red_eye',
  installs: 'cloud_download',
};

export const formatActivity = (map, activity) => map
  .filter((key) => key in activity)
  .map((key) => (
    <span key={key} title="great">
      <MIcon drop="4px" style={{ fontSize: '170%', opacity: 0.5 }}>
        {toIcon[key]}
      </MIcon>&nbsp;{activity[key]}
      &nbsp;&nbsp;&nbsp;&nbsp;
    </span>
  ));

export const formatDate = (d) => d ? new Date(d).toLocaleString() : 'N/A';

export const withStatefulActions = (bindActions) => compose(
  withStateHandlers({ pending: {} }, {
    startAction: ({ pending }) => (key) => ({
      pending: Object.assign({}, pending, { [key]: true }),
    }),
    endAction: ({ pending }) => (key) => ({
      pending: omit(pending, [key]),
    }),
  }),
  withHandlers(({ actions }) =>
    mapValues(actions, (action, key) =>
      // eslint-disable-next-line object-curly-newline
      ({ pending, startAction, endAction, actions: { [key]: callback } }) => (arg) => {
        if (pending[arg]) return;
        startAction(arg);
        callback(arg)
          .then(() => endAction(arg))
          .catch((e) => { endAction(arg); throw e; });
      })),
  withProps((props) => ({ bindActions: bindActions(props) })),
);
