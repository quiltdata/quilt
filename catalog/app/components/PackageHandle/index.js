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
  drop = false,
  isPublic,
  isTeam,
  name,
  owner,
  readmePreview,
  showPrefix,
}) {
  const team = config.team ? `${config.team.id}:` : '';
  const prefix = showPrefix ? `${team}${owner}/` : null;

  let label = 'private';
  if (isPublic === true) {
    label = 'public';
  } else if (isTeam === true) {
    label = 'team';
  } else {
    label = 'private';
  }

  return (
    <Text>
      <VisibilityIcon drop={drop} label={label} />&nbsp;
      <Lighter>{prefix}</Lighter>{name}
      <Preview>{readmePreview}</Preview>
    </Text>
  );
}

PackageHandle.defaultProps = {
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
