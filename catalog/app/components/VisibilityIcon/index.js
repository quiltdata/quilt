/* VisibilityIcon - visually represent public vs private */
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';

import MIcon from 'components/MIcon';

const toIcon = {
  private: 'lock',
  team: 'people',
};

export default function VisibilityIcon({ drop = false, label }) {
  const type = toIcon[label];
  if (type) {
    return (
      <Fragment>
        <MIcon drop={drop ? '4px' : undefined} style={{ opacity: 0.3 }} title={label}>
          {toIcon[label]}
        </MIcon>&nbsp;
      </Fragment>
    );
  }
  // take up no space if there isn't a valid decorator
  return <span></span>;
}

VisibilityIcon.propTypes = {
  drop: PropTypes.bool,
  label: PropTypes.string,
};
