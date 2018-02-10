/* Demo */
import React from 'react';

import { HCenter, Scroll } from 'components/LayoutHelpers';
import { FormattedMessage } from 'react-intl';

import messages from './messages';

export const id = 'Demo-Component';

function Demo() {
  return (
    <div id={id}>
      <h1><FormattedMessage {...messages.header} /></h1>
      <Scroll>
        <HCenter>
          <iframe
            title="Quilt Demo"
            width="560"
            height="315"
            src="https://www.youtube.com/embed/bKIV1GUVLPc"
            frameBorder="0"
            allowFullScreen
          />
        </HCenter>
      </Scroll>
    </div>
  );
}

export default Demo;
