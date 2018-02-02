/* MIcon - wrap material icon for convenience, style control */
import FontIcon from 'material-ui/FontIcon';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import { detailColorHex } from 'constants/style';

/* Drop the baseline so icons look good alongside text */
const Adjust = styled.span`
  position: relative;
  top: ${(props) => props.drop || 0}
`;

// eslint-disable-next-line object-curly-newline
function MIcon({ children, drop, title, ...rest }) {
  return (
    <Adjust drop={drop} title={title}>
      <FontIcon
        className="material-icons"
        {...rest}
      >
        { children }
      </FontIcon>
    </Adjust>
  );
}

MIcon.propTypes = {
  children: PropTypes.string.isRequired,
  color: PropTypes.string,
  drop: PropTypes.string,
  title: PropTypes.string,
};

MIcon.defaultProps = {
  color: detailColorHex,
};

export default MIcon;
