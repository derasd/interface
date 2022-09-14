import React, { useMemo, useCallback, Fragment } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { Line, Bar, LinePath } from '@visx/shape';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { curveMonotoneX } from '@visx/curve';
import { localPoint } from '@visx/event';
import { Group } from '@visx/group';
import { GridRows } from '@visx/grid';
import { scaleTime, scaleLinear } from '@visx/scale';
import { withTooltip, defaultStyles, TooltipWithBounds } from '@visx/tooltip';
import { WithTooltipProvidedProps } from '@visx/tooltip/lib/enhancers/withTooltip';
import { max, extent, bisector } from 'd3-array';
import { timeFormat } from 'd3-time-format';
import { FormattedReserveHistoryItem } from 'src/hooks/useReservesHistory';

type TooltipData = FormattedReserveHistoryItem;

const accentColorDark = '#383D511F';
const tooltipStyles = {
  ...defaultStyles,
  padding: '8px 12px',
  boxShadow: '0px 0px 2px rgba(0, 0, 0, 0.2), 0px 2px 10px rgba(0, 0, 0, 0.1)',
  borderRadius: '4px',
  color: '#62677B',
  fontSize: '12px',
  lineHeight: '16px',
  letterSpacing: '0.15px',
};

// util
const formatDate = timeFormat('%b %d, %H:%M UTC%Z');

// accessors
const getDate = (d: FormattedReserveHistoryItem) => new Date(d.date);
const bisectDate = bisector<FormattedReserveHistoryItem, Date>((d) => new Date(d.date)).left;
const getData = (d: FormattedReserveHistoryItem, fieldName: Field) => d[fieldName] * 100;

type Field = 'liquidityRate' | 'stableBorrowRate' | 'variableBorrowRate';

export type AreaProps = {
  width: number;
  height: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  data: FormattedReserveHistoryItem[];
  fields: { name: Field; color: string; text: string }[];
};

export const ApyGraph = withTooltip<AreaProps, TooltipData>(
  ({
    width,
    height,
    margin = { top: 0, right: 10, bottom: 20, left: 40 },
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipLeft = 0,
    data,
    fields,
  }: AreaProps & WithTooltipProvidedProps<TooltipData>) => {
    if (width < 10) return null;
    const theme = useTheme();

    // bounds
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // scales
    const dateScale = useMemo(
      () =>
        scaleTime({
          range: [0, innerWidth],
          domain: extent(data, getDate) as [Date, Date],
        }),
      [innerWidth, data]
    );
    const yValueScale = useMemo(() => {
      const valueMax = Math.max(
        ...fields.map((field) => max(data, (d) => getData(d, field.name)) as number)
      );
      return scaleLinear({
        range: [innerHeight, 0],
        domain: [0, (valueMax || 0) * 1.1],
        nice: true,
      });
    }, [innerHeight, data, fields]);

    // tooltip handler
    const handleTooltip = useCallback(
      (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
        const { x: _x } = localPoint(event) || { x: 0 };
        const x = _x - margin.left;
        const x0 = dateScale.invert(x);
        const index = bisectDate(data, x0, 1);
        const d0 = data[index - 1];
        const d1 = data[index];
        let d = d0;
        if (d1 && getDate(d1)) {
          d = x0.valueOf() - getDate(d0).valueOf() > getDate(d1).valueOf() - x0.valueOf() ? d1 : d0;
        }
        showTooltip({
          tooltipData: d,
          tooltipLeft: x,
        });
      },
      [showTooltip, dateScale, data, margin]
    );

    return (
      <>
        <svg width={width} height={height}>
          <Group left={margin.left} top={margin.top}>
            {/* Horizontal Background Lines */}
            <GridRows
              scale={yValueScale}
              width={innerWidth}
              strokeDasharray="3,3"
              stroke={theme.palette.divider}
              pointerEvents="none"
              numTicks={3}
            />

            {/* Data Value Lines */}
            {fields.map((field) => (
              <LinePath
                key={field.name}
                stroke={field.color}
                strokeWidth={2}
                data={data}
                x={(d) => dateScale(getDate(d)) ?? 0}
                y={(d) => yValueScale(getData(d, field.name)) ?? 0}
                curve={curveMonotoneX}
              />
            ))}

            {/* X Axis */}
            <AxisBottom
              top={innerHeight - margin.bottom / 4}
              scale={dateScale}
              strokeWidth={0}
              tickStroke={theme.palette.text.secondary}
              tickLabelProps={() => ({
                fill: theme.palette.text.secondary,
                fontSize: 8,
                dx: -8,
              })}
            />

            {/* Y Axis */}
            <AxisLeft
              left={0}
              scale={yValueScale}
              strokeWidth={0}
              tickLabelProps={() => ({
                fill: theme.palette.text.secondary,
                fontSize: 8,
                dx: -margin.left + 8,
              })}
              numTicks={3}
              tickFormat={(value) => `${(value as number).toFixed(2)} %`}
            />

            {/* Background */}
            <Bar
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              onTouchStart={handleTooltip}
              onTouchMove={handleTooltip}
              onMouseMove={handleTooltip}
              onMouseLeave={() => hideTooltip()}
            />

            {/* Tooltip */}
            {tooltipData && (
              <g>
                <Line
                  from={{ x: tooltipLeft, y: margin.top }}
                  to={{ x: tooltipLeft, y: innerHeight + margin.top }}
                  stroke={accentColorDark}
                  strokeWidth={2}
                  pointerEvents="none"
                  strokeDasharray="5,2"
                />
                {fields.map((field) => {
                  return (
                    <Fragment key={field.name}>
                      <circle
                        cx={tooltipLeft}
                        cy={yValueScale(getData(tooltipData, field.name)) + 1}
                        r={4}
                        fill="black"
                        fillOpacity={0.1}
                        stroke="black"
                        strokeOpacity={0.1}
                        strokeWidth={2}
                        pointerEvents="none"
                      />
                      <circle
                        cx={tooltipLeft}
                        cy={yValueScale(getData(tooltipData, field.name))}
                        r={4}
                        fill={accentColorDark}
                        stroke="white"
                        strokeWidth={2}
                        pointerEvents="none"
                      />
                    </Fragment>
                  );
                })}
              </g>
            )}
          </Group>
        </svg>

        {/* Tooltip Info */}
        {tooltipData && (
          <div>
            <TooltipWithBounds top={20} left={tooltipLeft + 12} style={tooltipStyles}>
              <Typography variant="secondary12" sx={{ mb: 2, mr: 2, fontWeight: 400 }}>
                {formatDate(getDate(tooltipData))}
              </Typography>
              {fields.map((field) => (
                <Box
                  key={field.name}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
                    {field.text}
                  </Typography>
                  <Typography variant="main12" color="text.primary">
                    {getData(tooltipData, field.name).toFixed(2)}%
                  </Typography>
                </Box>
              ))}
            </TooltipWithBounds>
          </div>
        )}
      </>
    );
  }
);