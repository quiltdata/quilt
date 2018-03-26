/* VisibilityIcon - visually represent public vs private */
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';

import MIcon from 'components/MIcon';

const toIcon = {
  private: 'lock',
  public: 'public',
  team: 'people',
};

export default function VisibilityIcon({ drop = false, label }) {
  const type = toIcon[label];
  const opacity = type ? 0.5 : 1;
  return (
    <Fragment>
      <MIcon
        drop={drop ? '4px' : undefined}
        style={{ fontSize: 'inherit', opacity }}
        title={label}
      >
        {type || 'check_box_outline_blank' }
      </MIcon>&nbsp;
    </Fragment>
  );
}

VisibilityIcon.propTypes = {
  drop: PropTypes.bool,
  label: PropTypes.string,
};
