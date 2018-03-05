/* VisibilityIcon - visually represent public vs private */
import PropTypes from 'prop-types';
import React from 'react';

import MIcon from 'components/MIcon';

const toIcon = {
  public: 'language',
  private: 'lock_outline',
  team: 'people_outline',
}

export default function VisibilityIcon({ drop = false, label }) {
  return (
    <MIcon drop={drop ? '4px' : undefined} style={{ opacity: 0.3 }} title={label}>
      {toIcon[label]}
    </MIcon>
  );
}

VisibilityIcon.propTypes = {
  drop: PropTypes.bool,
  label: PropTypes.string.isRequired,
};
