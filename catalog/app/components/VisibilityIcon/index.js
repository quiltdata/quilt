/* VisibilityIcon - visually represent public vs private */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import MIcon from 'components/MIcon';

const Tag = styled.span`
  border: 1px solid;
  border-radius: 4px;
  font-size: 70%;
  margin-left: .5em;
  opacity: .5;
  padding: 0px 4px 1px 4px;
`;

const toIcon = {
  public: 'language',
  private: 'lock_outline',
  team: 'people_outline',
}

export default function VisibilityIcon({ label }) {
  //return <Tag className="fixed">{label}</Tag>;
  return <MIcon drop="4px">null</MIcon>
}

VisibilityIcon.propTypes = {
  label: PropTypes.string.isRequired,
};
