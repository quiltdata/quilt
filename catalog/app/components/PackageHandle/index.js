/* PackageHandle - Generate package handles in the right style */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import config from 'constants/config';
import VisibilityIcon from 'components/VisibilityIcon';

const Lighter = styled.span`
  opacity: 0.6;
`;

const Text = styled.div`
  height: 1.5em;
  line-height: 1.5em;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// eslint-disable-next-line object-curly-newline
function PackageHandle({ isPublic, isTeam, name, owner, showPrefix }) {
  const team = config.team ? `${config.team.id}:` : '';
  const prefix = showPrefix ? `${team}${owner}/` : null;

  let label;
  if (isTeam) {
    label = 'team';
  } else if (isPublic === false) { // don't show 'private' if undefined
    label = 'private';
  }
  const decorator = label ? <VisibilityIcon label={label} /> : null;

  return <Text><Lighter>{prefix}</Lighter>{name} {decorator}</Text>;
}

PackageHandle.defaultProps = {
  showPrefix: true,
};

PackageHandle.propTypes = {
  isPublic: PropTypes.bool,
  isTeam: PropTypes.bool,
  name: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  showPrefix: PropTypes.bool,
};

export default PackageHandle;
