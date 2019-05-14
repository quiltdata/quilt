import {
  grey300 as viewLow,
  grey800 as viewHigh,
  blueGrey100 as installLow,
  blueGrey800 as installHigh,
} from 'material-ui/styles/colors';

import PT from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedDate as FD, FormattedMessage as FM } from 'react-intl';
import {
  setPropTypes,
  withHandlers,
  withStateHandlers,
} from 'recompose';
import styled from 'styled-components';

import Sparkline from 'components/Sparkline';
import { composeComponent } from 'utils/reactTools';
import { readableQuantity } from 'utils/string';

import msg from './messages';

const pluckValues = (a) => a.map((x) => x.value);

const SparkContainer = styled.dd`
  align-items: baseline;
  display: flex;
  justify-content: space-between;
`;

const SparkValue = styled.span`
  font-size: 1.5em;
  line-height: 1;
`;

const StyledSparkline = styled(Sparkline)`
  width: 80%;
`;

const WeeklyTrafficShape = PT.arrayOf(PT.shape({
  from: PT.instanceOf(Date).isRequired,
  to: PT.instanceOf(Date).isRequired,
  value: PT.number.isRequired,
}));

const TrafficShape = PT.shape({
  weekly: WeeklyTrafficShape.isRequired,
  total: PT.number.isRequired,
});

const TrafficOrError = PT.oneOfType([
  PT.instanceOf(Error),
  TrafficShape,
]);

const Section = composeComponent('Package.Traffic.Section',
  setPropTypes({
    label: PT.node.isRequired,
    data: TrafficOrError,
    color: PT.string.isRequired,
    color2: PT.string,
  }),
  withStateHandlers({
    cursor: null,
  }, {
    setCursor: () => (cursor) => ({ cursor }),
  }),
  withHandlers({
    handleCursor: ({ setCursor }) => setCursor,
  }),
  ({
    label,
    data,
    handleCursor,
    cursor,
    color,
    color2 = color,
  }) => (
    <Fragment>
      <dt>
        {label} ({cursor === null || !data || data instanceof Error
          ? <FM {...msg.trafficTotal} />
          : (
            <FM
              {...msg.trafficRange}
              values={{
                from: <FD value={data.weekly[cursor].from} />,
                to: <FD value={data.weekly[cursor].to} />,
              }}
            />
          )
        })
      </dt>
      <SparkContainer>
        <SparkValue>
          {readableQuantity(
            cursor === null
              ? data && data.total
              : data && data.weekly && data.weekly[cursor].value
          )}
        </SparkValue>
        {data && data.weekly && (
          <StyledSparkline
            data={pluckValues(data.weekly)}
            onCursor={handleCursor}
            width={200}
            height={20}
            color={color}
            color2={color2}
            fill={false}
          />
        )}
      </SparkContainer>
    </Fragment>
  ));

export default composeComponent('Package.Traffic',
  setPropTypes({
    installs: TrafficOrError,
    views: TrafficOrError,
  }),
  ({ installs, views }) => (
    <div>
      <h2><FM {...msg.trafficHeading} /></h2>
      <dl>
        <Section
          label={<FM {...msg.trafficInstalls} />}
          data={installs}
          color={installLow}
          color2={installHigh}
        />
        <Section
          label={<FM {...msg.trafficViews} />}
          data={views}
          color={viewLow}
          color2={viewHigh}
        />
      </dl>
    </div>
  ));
