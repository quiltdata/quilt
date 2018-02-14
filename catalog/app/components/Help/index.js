/* Help - inline help for features */
import PropTypes from 'prop-types';
import React from 'react';
import FlatButton from 'material-ui/FlatButton';

import QButton from 'components/QButton';

// TODO dynamically use <Link> if href is relative or <a> if href is absolute
// eslint-disable-next-line object-curly-newline
function Help({ children, href, primary, raised, secondary }) {
  return (
    raised ?
      <QButton
        href={href}
        label={children}
        primary={primary}
        secondary={secondary}
      /> :
      <FlatButton
        href={href}
        label={children}
        primary={primary}
        secondary={secondary}
      />
  );
}

Help.propTypes = {
  children: PropTypes.node,
  href: PropTypes.string.isRequired,
  primary: PropTypes.bool,
  raised: PropTypes.bool,
  secondary: PropTypes.bool,
};

Help.defaultProps = {
  children: 'Learn more',
  raised: true,
};

export default Help;
