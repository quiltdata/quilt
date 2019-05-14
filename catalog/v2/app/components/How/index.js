/* How Quilt works */
import React from 'react';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';

import diagram from 'img/big-picture.png';

import messages from './messages';

const Image = styled.img`
  display: block;
  /* magic number = actual width of image */
  margin: 2em auto;
  max-width: 500px;
  width: 100%;
`;

function How() {
  return (
    <div>
      <h1><FormattedMessage {...messages.header} /></h1>
      <p>
        <em>Build</em> packages on the command line, <em>push</em>&nbsp;
        packages to the registry, and <em>install</em> packages anywhere you choose.
      </p>
      <Image src={diagram} />
    </div>
  );
}

export default How;
