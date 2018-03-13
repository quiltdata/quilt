import mapValues from 'lodash/mapValues';
import omit from 'lodash/omit';
import React from 'react';
import styled from 'styled-components';
import { compose, withHandlers, withProps, withStateHandlers } from 'recompose';

import MIcon from 'components/MIcon';


const toIcon = {
  packages: 'cloud_upload',
  previews: 'remove_red_eye',
  installs: 'cloud_download',
};

const HStack = styled.div`
  display: inline-block;
  overflow: hidden;
  margin: 0 1em 0 1em;
  opacity: .5;
  padding: 0;
  max-width: 5em;
  text-align: left;
  text-overflow: ellipsis;
  width: 5em;
`;

export const formatActivity = (map, activity) => map
  .filter((key) => key in activity)
  .map((key) => (
    <HStack key={key}>
      <MIcon drop="6px" title={key}>
        {toIcon[key]}
      </MIcon> {activity[key]}
    </HStack>
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
