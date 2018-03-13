/* PackageHandle - Generate package handles in the right style */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import config from 'constants/config';
import VisibilityIcon from 'components/VisibilityIcon';

const Lighter = styled.span`
  opacity: 0.7;
`;

const Preview = styled.span`
  margin-left: 16px;
  opacity: 0.5;
`;

const Text = styled.div`
  line-height: 1.5em;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// eslint-disable-next-line object-curly-newline
function PackageHandle({
  drop,
  isPublic,
  isTeam,
  name,
  owner,
  readmePreview,
  showPrefix,
}) {
  const team = config.team ? `${config.team.id}:` : '';
  const prefix = showPrefix ? `${team}${owner}/` : null;
  // eslint-disable-next-line no-nested-ternary
  const label = isPublic ? 'public' : isTeam ? 'team' : 'private';

  return (
    <Text>
      <VisibilityIcon drop={drop} label={label} />&nbsp;
      <Lighter>{prefix}</Lighter>{name}
      <Preview>{readmePreview}</Preview>
    </Text>
  );
}

PackageHandle.defaultProps = {
  drop: false,
  isPublic: true,
  showPrefix: true,
};

PackageHandle.propTypes = {
  drop: PropTypes.bool,
  isPublic: PropTypes.bool,
  isTeam: PropTypes.bool,
  name: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  readmePreview: PropTypes.string,
  showPrefix: PropTypes.bool,
};

export default PackageHandle;
