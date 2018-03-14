import PT from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import { setPropTypes } from 'recompose';
import styled from 'styled-components';

import MIcon from 'components/MIcon';
import { composeComponent } from 'utils/reactTools';


const ICONS = {
  packages: 'cloud_upload',
  previews: 'remove_red_eye',
  installs: 'cloud_download',
};

const TITLES = {
  packages: 'Pushes',
  previews: 'Previews',
  installs: 'Installs',
};

export const ActivityLink = styled(Link)`
  color: inherit !important;
  display: inline-block;
  opacity: 0.5;

  &:hover {
    opacity: 0.8;
  }
`;

const HStack = styled.span`
  display: inline-block;
  max-width: 5em;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
  width: 5em;

  > * {
    vertical-align: bottom;
  }

  * + * {
    margin-left: 0.5em;
  }
`;

export const Activity = composeComponent('Admin.Activity',
  setPropTypes({
    type: PT.oneOf(Object.keys(ICONS)).isRequired,
    children: PT.node,
  }),
  ({ type, children }) => (
    <HStack>
      <MIcon title={TITLES[type]}>{ICONS[type]}</MIcon>
      <span>{children}</span>
    </HStack>
  ));

export const formatActivity = (map, activity) => map
  .filter((type) => type in activity)
  .map((type) => <Activity key={type} type={type}>{activity[type]}</Activity>);
