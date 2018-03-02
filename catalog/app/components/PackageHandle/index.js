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
  overflow: visible;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// eslint-disable-next-line object-curly-newline
function PackageHandle({ isPublic, name, owner, showPrefix }) {
  const team = config.team ? `${config.team.id}:` : '';
  const prefix = showPrefix ? `${team}${owner}/` : null;
  const decorator = (
    isPublic === true || typeof isPublic !== 'boolean' ? null
      : <VisibilityIcon label="private" />
  );
  return <Text><Lighter>{prefix}</Lighter>{name} {decorator}</Text>;
}

PackageHandle.defaultProps = {
  showPrefix: true,
};

PackageHandle.propTypes = {
  isPublic: PropTypes.bool.isRequired,
  name: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  showPrefix: PropTypes.bool,
};

export default PackageHandle;
