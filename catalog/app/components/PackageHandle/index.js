/* PackageHandle - Generate package handles in the right style */
import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import config from 'constants/config';
import VisibilityIcon from 'components/VisibilityIcon';

const Lighter = styled.span`
  opacity: 0.7;
  a, a:active, a:hover, a:visited {
    text-decoration: none;
  }
`;

const Preview = styled.span`
  margin-left: 16px;
  opacity: 0.5;
`;

const Text = styled.div`
  line-height: 1.5em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

function PackageHandle({
  drop = false,
  isPublic = true,
  isTeam,
  linkUser = false,
  name,
  owner,
  readmePreview,
  showPrefix = true,
}) {
  const team = config.team ? `${config.team.id}:` : '';
  const prefix = showPrefix ? `${team}${owner}/` : null;

  let label = 'private';
  if (isPublic === true) {
    label = 'public';
  } else if (isTeam === true) {
    label = 'team';
  }

  return (
    <Text>
      <VisibilityIcon drop={drop} label={label} />
      <Lighter>
        {
          linkUser ?
            <Link to={`/package/${owner}/`}>{prefix}</Link>
            : prefix
        }
      </Lighter>
      {name}
      <Preview>{readmePreview}</Preview>
    </Text>
  );
}

PackageHandle.propTypes = {
  drop: PropTypes.bool,
  isPublic: PropTypes.bool,
  isTeam: PropTypes.bool,
  linkUser: PropTypes.bool,
  name: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  readmePreview: PropTypes.string,
  showPrefix: PropTypes.bool,
};

export default PackageHandle;
