/* Tag */
import React from 'react';
import styled from 'styled-components';

import { FormattedMessage } from 'react-intl';
import messages from './messages';

const Style = styled.span`
  border: 1px solid;
  border-radius: 2px;
  font-size: 50%;
  margin-left: 1em;
  margin-bottom: 8px;
  opacity: .5;
  padding: 1px 4px;
  vertical-align: middle;
`;

function Tag() {
  return (
    <Style>
      <FormattedMessage {...messages.header} />
    </Style>
  );
}

Tag.propTypes = {
  label: React.PropTypes.string.isRequired,
};

export default Tag;
