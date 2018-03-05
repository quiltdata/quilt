/* HomePage */
import React from 'react';
import styled from 'styled-components';

import config from 'constants/config';
import Demo, { id } from 'components/Demo';
import Feature from 'components/Feature';
import Intro from 'components/Intro';
import { BigSkip, HCenter, Pad, UnPad } from 'components/LayoutHelpers';
import Pricing from 'components/Pricing';
import Values from 'components/Values';

function makeScrollToId(eid) {
  return () => {
    const e = document.getElementById(eid);
    if (e) e.scrollIntoView();
  };
}

const Styler = styled.div`
  h1 {
    font-size: 3em;
    margin-bottom: 1em;
    margin-top: 3em;
    text-align: center;
  }
`;

export default class HomePage extends React.PureComponent { // eslint-disable-line react/prefer-stateless-function
  render() {
    const { team = {} } = config;
    const header = team.id ? team.name || team.id : undefined;
    const tagline = team.id ? 'Team data registry' : undefined;
    const signUp = Boolean(!team.id);

    return (
      <UnPad>
        <Feature
          header={header}
          onClickPrimary={makeScrollToId()}
          onClickSecondary={makeScrollToId(id)}
          tagline={tagline}
          signUp={signUp}
        />
        <Pad top left right bottom>
          <Intro />
          <Styler>
            <h1>Work with your favorite tools</h1>
            <Values />
            <Demo />
            {
              team.id ? null : (
                <HCenter>
                  <Pricing signUp={signUp} />
                </HCenter>
              )
            }
          </Styler>
        </Pad>
        <BigSkip />
      </UnPad>
    );
  }
}
