/* Pricing */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';
import { Tabs, Tab } from 'material-ui/Tabs';

import TakeAction from 'components/TakeAction';

export const width = 900;

const Styler = styled.div`
  overflow: auto;
  max-width: ${width}px;

  .faint {
    opacity: 0.5;
  }

  p {
    color: black;
    text-align: left;
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

function Pricing({ signUp, takeAction }) {
  return (
    <Styler>
      <h1 id="pricing">Pricing</h1>
      <Tabs>
        <Tab label="Cloud">
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
                  • Unlimited public packages<br />
                  • Up to 1TB of private packages<br />
                </td>
                <td>
                  • Unlimited public packages<br />
                  • 1TB and up of private packages<br />
                  • Priority support<br />
                  • Admin and auditing features<br />
                  • Dedicated registry and catalog<br />
                  * Sold in blocks of 10 users<br />
                </td>
              </tr>
            </tbody>
          </table>
        </Tab>
      </Tabs>
      <p>
        <a href="mailto:sales@quiltdata.io?Subject=Quilt%20Teams%20Tier" target="_top">
          Contact us
        </a> to start Teams service.
      </p>
      { takeAction ? <TakeAction signUp={signUp} /> : null }
    </Styler>
  );
}

Pricing.propTypes = {
  signUp: PropTypes.bool,
  takeAction: PropTypes.bool,
};

Pricing.defaultProps = {
  takeAction: true,
};

export default Pricing;
