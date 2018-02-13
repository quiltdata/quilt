/* UseCases for Quilt */
import PropTypes from 'prop-types';
import React from 'react';
import { Col, Row } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';

import Help from 'components/Help';
import MIcon from 'components/MIcon';
import { h2HomeSize } from 'constants/style';
import { blogManage, blogYC } from 'constants/urls';

import messages from './messages';

const link = <MIcon drop="7px">link</MIcon>;
const Styler = styled.div`
  h2 {
    font-size: ${h2HomeSize};
    margin-bottom: 0;
    margin-top: 1em;
  }
`;

// eslint-disable-next-line object-curly-newline
const Case = ({ call, callHref, detail, title }) => (
  <Styler>
    <h2>{title}</h2>
    <p>{detail}</p>
    <div className="call">
      {
        call && callHref ?
          <span>
            <Help href={callHref} raised={false}>
              {link} {call}
            </Help>
          </span>
          : null
      }
    </div>
  </Styler>
);

Case.propTypes = {
  call: PropTypes.node,
  callHref: PropTypes.string,
  detail: PropTypes.node,
  title: PropTypes.node,
};

function UseCases() {
  return (
    <div>
      <h1><FormattedMessage {...messages.header} /></h1>
      <Row>
        <Col xs={12} md={4}>
          <Case
            call="UCI Machine Learning Data"
            callHref="/search/?q="
            detail={<FormattedMessage {...messages.machineDetail} />}
            title={<FormattedMessage {...messages.machineTitle} />}
          />
        </Col>
        <Col xs={12} md={4}>
          <Case
            call="Fast, reproducible data science"
            callHref={blogYC}
            detail={<FormattedMessage {...messages.dataDetail} />}
            title={<FormattedMessage {...messages.dataTitle} />}
          />
        </Col>
        <Col xs={12} md={4}>
          <Case
            call="Manage data like code"
            callHref={blogManage}
            detail={<FormattedMessage {...messages.engDetail} />}
            title={<FormattedMessage {...messages.engTitle} />}
          />
        </Col>
      </Row>
    </div>
  );
}

UseCases.propTypes = {

};

export default UseCases;
