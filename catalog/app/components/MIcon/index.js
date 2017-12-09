/* MIcon - wrap material icon for convenience, style control */
import FontIcon from 'material-ui/FontIcon';
import React from 'react';
import styled from 'styled-components';

import { detailColorHex } from 'constants/style';

/* Drop the baseline so icons look good alongside text */
const Adjust = styled.span`
  position: relative;
  top: ${(props) => props.drop || 0}
`;

function MIcon(props) {
  // color gets spread to FontIcon; we don't need to use it locally
  const { children, color, drop, title } = props; // eslint-disable-line no-unused-vars
  // consume props that FontIcon won't recognize or React complains
  const cleanProps = Object.assign({}, props);
  delete cleanProps.drop;
  delete cleanProps.title;
  return (
    <Adjust drop={drop} title={title}>
      <FontIcon
        className="material-icons"
        {...cleanProps}
      >
        { children }
      </FontIcon>
    </Adjust>
  );
}

MIcon.propTypes = {
  children: React.PropTypes.string.isRequired,
  color: React.PropTypes.string,
  drop: React.PropTypes.string,
  title: React.PropTypes.string,
};

MIcon.defaultProps = {
  color: detailColorHex,
};

export default MIcon;
