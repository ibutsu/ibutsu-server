/**
 * Inline heatmap grid component replacing the abandoned react-heatmap-grid package.
 * Renders a table-like grid of colored cells with x/y labels and custom cell rendering.
 */
const HeatMapWrapper = ({
  xLabels = [],
  yLabels = [],
  yLabelWidth = 60,
  yLabelTextAlign = 'right',
  data = [],
  squares = false,
  cellStyle = () => ({}),
  cellRender = (value) => value,
  title = () => '',
  onClick = () => {},
  ...otherProps
}) => {
  const cellSize = squares ? 25 : undefined;

  const allValues = data.flat().filter((v) => v != null);
  const numericValues = allValues.map(Number).filter((n) => !isNaN(n));
  const min = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const max = numericValues.length > 0 ? Math.max(...numericValues) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }} {...otherProps}>
      {/* X-axis labels row */}
      <div style={{ display: 'flex' }}>
        <div style={{ width: `${yLabelWidth}px`, flexShrink: 0 }} />
        {xLabels.map((label) => (
          <div
            key={label}
            style={{
              flex: squares ? undefined : 1,
              width: cellSize,
              textAlign: 'center',
              fontSize: '11px',
              overflow: 'hidden',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {yLabels.map((yLabel, yi) => (
        <div key={yLabel} style={{ display: 'flex', alignItems: 'center' }}>
          {/* Y-axis label */}
          <div
            style={{
              width: `${yLabelWidth}px`,
              flexShrink: 0,
              textAlign: yLabelTextAlign,
              paddingRight: '5px',
              fontSize: '11px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {yLabel}
          </div>

          {/* Data cells */}
          {xLabels.map((xLabel, xi) => {
            const value = (data[yi] || [])[xi];
            const style = cellStyle(null, value, min, max, data, xi, yi);
            return (
              <div
                key={xLabel}
                role="button"
                tabIndex={0}
                title={title(value, xi, yi)}
                onClick={() => onClick(xi, yi)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onClick(xi, yi);
                }}
                style={{
                  flex: squares ? undefined : 1,
                  width: cellSize,
                  height: cellSize || 25,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  ...style,
                }}
              >
                {cellRender(value, xi, yi)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default HeatMapWrapper;
