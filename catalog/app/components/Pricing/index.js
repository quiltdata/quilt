/* Pricing */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import TakeAction from 'components/TakeAction';
import scrollIntoView from 'utils/scrollIntoView';

export const width = 900;

const Styler = styled.div`
  overflow: auto;
  max-width: ${width}px;

  .faint {
    opacity: 0.5;
  }

  table {
    background-color: #eee;
    color: black;
    table-layout: fixed;
    text-align: left;
    width: ${width}px;
  }

  td {
    border: 1px solid white;
    font-weight: lighter;
    padding: 16px;
    vertical-align: top;
  }

  td .unit {
    font-size: .8em;
    opacity: 0.5;
  }

  tr.price h2 {
    font-size: 1.5em;
  }

  th {
    border: 1px solid white;
    font-size: 1.5em;
    font-weight: lighter;
    padding: 16px;
    text-align: left;
  }
`;

const perUser = <span className="unit">per user / month</span>;

function Pricing({ signUp, takeAction = true, title = 'Pricing' }) {
  return (
    <Styler>
      <h1 id="pricing" ref={scrollIntoView()}>{title}</h1>
      <table>
        <tbody>
          <tr>
            <th>Free</th>
            <th>Individual</th>
          </tr>
          <tr className="price">
            <td>
              <h2>$0 { perUser }</h2>
            </td>
            <td>
              <h2>$7 { perUser }</h2>
            </td>
          </tr>
          <tr>
            <td>
              • Unlimited public packages<br />
            </td>
            <td>
              • Unlimited public packages<br />
              • Up to 1TB of private packages<br />
            </td>
          </tr>
        </tbody>
      </table>
      <br />
      {takeAction ? <TakeAction signUp={signUp} /> : null}
    </Styler>
  );
}

Pricing.propTypes = {
  signUp: PropTypes.bool,
  takeAction: PropTypes.bool,
  title: PropTypes.string,
};

export default Pricing;
