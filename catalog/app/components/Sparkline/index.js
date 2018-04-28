import clamp from 'lodash/clamp';
import PT from 'prop-types';
import React from 'react';
import {
  defaultProps,
  setPropTypes,
  withHandlers,
  withPropsOnChange,
  withStateHandlers,
} from 'recompose';
import uuid from 'uuid/v1';

import { bodyColor } from 'constants/style';
import { composeComponent } from 'utils/reactTools';

const dataToPoints = (data, { width = 1, height = 1, padding = 0 } = {}) => {
  const max = Math.max(...data) || 1;

  const vfactor = (height - (padding * 2)) / max;
  const hfactor = (width - (padding * 2)) / (data.length - 1);

  return data.map((d, i) => ({
    x: padding + (i * hfactor),
    y: padding + ((max - d) * vfactor),
  }));
};

const pointsToSVG = (points) =>
  points.map(({ x, y }) => `${x} ${y}`).join(' ');

const getMousePos = (e, { padding = 0 } = {}) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const relativePos = e.clientX - rect.x - padding;
  const adjustedWidth = rect.width - (padding * 2);
  return relativePos / adjustedWidth;
};


export default composeComponent('Sparkline',
  setPropTypes({
    data: PT.arrayOf(PT.number).isRequired,
    fill: PT.bool,
    width: PT.number,
    height: PT.number,
    color: PT.string,
    color2: PT.string,
    contourThickness: PT.number,
    cursorLineThickness: PT.number,
    cursorCircleR: PT.number,
    cursorCircleThickness: PT.number,
    padding: PT.number,
    onCursor: PT.func,
  }),
  defaultProps({
    fill: true,
    width: 200,
    height: 20,
    color: bodyColor,
    contourThickness: 2,
    cursorLineThickness: 1,
    cursorCircleR: 1.5,
    cursorCircleThickness: 1.5,
    padding: 3,
  }),
  withStateHandlers(() => ({ cursor: null }), {
    showCursor: () => (cursor) => ({ cursor }),
    hideCursor: () => () => ({ cursor: null }),
  }),
  withHandlers({
    handleMove: ({ showCursor, onCursor, data, padding }) => (e) => {
      const pos = getMousePos(e, { padding });
      const step = 1 / (data.length - 1);
      const idx = clamp(Math.round(pos / step), 0, data.length - 1);
      showCursor(idx);
      if (onCursor) onCursor(idx);
    },
    handleLeave: ({ hideCursor, onCursor }) => () => {
      hideCursor();
      if (onCursor) onCursor(null);
    },
  }),
  withPropsOnChange(
    ['data', 'cursor', 'width', 'height', 'padding'],
    // eslint-disable-next-line object-curly-newline
    ({ data, fill, cursor, width, height, padding }) => {
      const contour = dataToPoints(data, { width, height, padding });

      const fillShape = fill
        ? [
          ...contour,
          { ...contour[contour.length - 1], y: height },
          { ...contour[0], y: height },
          contour[0],
        ]
        : null;

      const cursorPos = cursor === null ? null : contour[cursor];
      return { contour, fill: fillShape, cursorPos };
    }
  ),
  withPropsOnChange(
    ['color', 'color2', 'width', 'height', 'padding'],
    ({ color, color2 = color }) => {
      const gradientId = `gradient-${uuid()}`;
      return {
        color2,
        gradientId,
        gradient: `url(#${gradientId})`,
      };
    }
  ),
  ({
    width,
    height,
    padding,
    handleMove,
    handleLeave,
    contour,
    fill,
    cursorPos,
    color,
    color2,
    gradient,
    gradientId,
    contourThickness,
    cursorLineThickness,
    cursorCircleR,
    cursorCircleThickness,
    // not used here:
    data,
    onCursor,
    showCursor,
    hideCursor,
    ...props
  }) => (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
      {...props}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1={height - 2 * padding}
          x2="0"
          y2={padding}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <g>
        {cursorPos && (
          <g>
            <line
              x1={cursorPos.x}
              y1={0}
              x2={cursorPos.x}
              y2={height}
              stroke={gradient}
              strokeWidth={cursorLineThickness}
            />
            <circle
              cx={cursorPos.x}
              cy={cursorPos.y}
              r={cursorCircleR}
              stroke={gradient}
              strokeWidth={cursorCircleThickness}
              fill="none"
            />
          </g>
        )}
        {fill && (
          <polyline
            points={pointsToSVG(fill)}
            fill={gradient}
            fillOpacity=".1"
            pointerEvents="auto"
            stroke="none"
            strokeWidth="0"
          />
        )}
        <polyline
          points={pointsToSVG(contour)}
          stroke={gradient}
          strokeWidth={contourThickness}
          strokeLinecap="round"
          strokeLinejoin="miter"
          fill="none"
        />
      </g>
    </svg>
  ));
