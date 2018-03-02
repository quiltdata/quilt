/* Pricing */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import TakeAction from 'components/TakeAction';

export const width = 900;

const emailBody = `To get started, tell us about your team.%0D%0A
%0D%0A
Team size:%0D%0A
Team id (short alphabetical string e.g. "MegaCorp"):%0D%0A
Admin name:%0D%0A
Admin username:%0D%0A
Admin email:%0D%0A
Admin phone:%0D%0A
%0D%0A
Thanks. We'll get back to you right away.%0D%0A
`;

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

const Detail = styled.p`
  text-align: right;
`;

const perUser = <span className="unit">per user / month</span>;

function Pricing({ signUp, takeAction = true, title = 'Pricing' }) {
  return (
    <Styler>
      <h1 id="pricing">{title}</h1>
      <table>
        <tbody>
          <tr>
            <th>Free</th>
            <th>Individual</th>
            <th>Team</th>
          </tr>
          <tr className="price">
            <td>
              <h2>$0 { perUser }</h2>
            </td>
            <td>
              <h2>$7 { perUser }</h2>
            </td>
            <td>
              <h2>$49* { perUser }</h2>
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
            <td>
              • Unlimited public packages<br />
              • 1TB and up of private packages<br />
              • Priority support<br />
              • Admin and auditing features<br />
              • Dedicated registry and web catalog, exclusive to your team<br />
            </td>
          </tr>
        </tbody>
      </table>
      <Detail>* Sold in packs of 10 users</Detail>
      <p>
        <a href={`mailto:sales@quiltdata.io?Subject=Quilt%20Teams&body=${emailBody}`} target="_top" >
          Contact us
        </a>
        &nbsp;to start Team service.
      </p>
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
