/* FAIcon - FontAwesomeIcon wrapper */
import React from 'react';

const lookup = {
  github: 'fa-mark-github',
  medium: 'fa-medium',
  twitter: 'fa-twitter',
};

function FAIcon({ className, type }) {
  const myClass = `fa ${lookup[type]} ${className}`;
  return (
    <i className={myClass}></i>
  );
}

FAIcon.propTypes = {
  className: React.PropTypes.string,
  type: React.PropTypes.oneOf(['twitter', 'github', 'medium']).isRequired,
};

export default FAIcon;
