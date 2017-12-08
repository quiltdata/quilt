/* VisibilityIcon - visually represent public vs private */
import React, { PropTypes } from 'react';

import styled from 'styled-components';

const Tag = styled.span`
  border: 1px solid;
  border-radius: 4px;
  font-size: 70%;
  margin-left: .5em;
  opacity: .5;
  padding: 2px 4px 2px 4px;
`;

export default function VisibilityIcon({ label }) {
  return <Tag className="fixed">{label}</Tag>;
}

VisibilityIcon.propTypes = {
  label: PropTypes.string,
};
