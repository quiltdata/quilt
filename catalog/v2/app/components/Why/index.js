import React from 'react';

import { Pad, SpaceRows } from 'components/LayoutHelpers';
import Values from 'components/Values';

function Why() {
  return (
    <div id={name}>
      <Pad left right bottom>
        <SpaceRows>
          <Values />
        </SpaceRows>
      </Pad>
    </div>
  );
}

Why.propTypes = {

};

export const name = 'lead';

export default Why;
