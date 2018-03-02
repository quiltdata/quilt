/* VisibilityIcon - visually represent public vs private */
import PropTypes from 'prop-types';
import React from 'react';

import MIcon from 'components/MIcon';

const toIcon = {
  private: 'lock',
  team: 'people',
};

export default function VisibilityIcon({ drop = false, label }) {
  return (
    <MIcon drop={drop ? '4px' : undefined} style={{ opacity: 0.5 }} title={label}>
      {toIcon[label]}
    </MIcon>
  );
}

VisibilityIcon.propTypes = {
  drop: PropTypes.bool,
  label: PropTypes.string,
};
