/* PackageHandle - Generate package handles in the right style */
import React from 'react';
import styled from 'styled-components';

import VisibilityIcon from 'components/VisibilityIcon';

const Lighter = styled.span`
  opacity: 0.6;
`;

const Text = styled.div`
  height: 1.5em;
  line-height: 1.5em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

function PackageHandle({ isPublic, name, owner, showOwner }) {
  const ownerString = showOwner ? <Lighter>{owner}/</Lighter> : null;
  const decorator = (
    isPublic === true || typeof isPublic !== 'boolean' ? null
    : <VisibilityIcon label={'private'} />
  );
  return <Text>{ownerString}{name} {decorator}</Text>;
}

PackageHandle.defaultProps = {
  showOwner: true,
};

PackageHandle.propTypes = {
  isPublic: React.PropTypes.bool.isRequired,
  name: React.PropTypes.string.isRequired,
  owner: React.PropTypes.string.isRequired,
  showOwner: React.PropTypes.bool,
};

export default PackageHandle;
