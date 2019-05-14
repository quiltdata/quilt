/* FAIcon - FontAwesomeIcon wrapper */
import PropTypes from 'prop-types';
import React from 'react';

const lookup = {
  bookmark: 'fa-bookmark',
  chatBubble: 'fa-chat-bubble',
  github: 'fa-mark-github',
  medium: 'fa-medium',
  slack: 'fa-slack',
  twitter: 'fa-twitter',
};

function FAIcon({ className, type }) {
  const myClass = `fa ${lookup[type]} ${className}`;
  return (
    <i className={myClass}></i>
  );
}

FAIcon.propTypes = {
  className: PropTypes.string,
  type: PropTypes.oneOf([
    'bookmark',
    'chatBubble',
    'github',
    'medium',
    'slack',
    'twitter',
  ]).isRequired,
};

export default FAIcon;
