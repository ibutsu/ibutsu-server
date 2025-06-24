import { ICON_RESULT_MAP } from '../constants';
import PropTypes from 'prop-types';

// Define the legend component outside of the hook
const ResultWidgetLegend = ({ x, y, datum, style }) => {
  const iconSize = 16;
  const textOffset = iconSize + 8;
  const resultType = datum?.symbol?.type;

  // Get the appropriate icon from ICON_RESULT_MAP (already has correct colors)
  const IconComponent = ICON_RESULT_MAP[resultType];

  if (!IconComponent) {
    // Fallback to simple rectangle if no icon found
    return (
      <g>
        <rect
          x={x}
          y={y - iconSize / 2}
          width={iconSize}
          height={iconSize}
          fill={
            datum.symbol?.fill || 'var(--pf-t--global--color--brand--default)'
          }
          rx={2}
        />
        <text
          x={x + textOffset}
          y={y}
          dy="0.35em"
          style={{
            fill: style?.fill || 'var(--pf-t--global--text--color--regular)',
          }}
        >
          {datum.name}
        </text>
      </g>
    );
  }

  // Create a foreign object to embed the React icon component
  return (
    <g>
      <foreignObject
        x={x}
        y={y - iconSize / 2}
        width={iconSize}
        height={iconSize}
      >
        <div
          style={{
            width: iconSize,
            height: iconSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {IconComponent}
        </div>
      </foreignObject>
      <text
        x={x + textOffset}
        y={y}
        dy="0.35em"
        style={{
          fill: style?.fill || 'var(--pf-t--global--text--color--regular)',
          fontFamily: 'RedHatText, sans-serif',
        }}
      >
        {datum.name}
      </text>
    </g>
  );
};

// Define PropTypes for the component
ResultWidgetLegend.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  datum: PropTypes.shape({
    name: PropTypes.string,
    symbol: PropTypes.shape({
      type: PropTypes.string,
      fill: PropTypes.string,
    }),
  }).isRequired,
  style: PropTypes.object,
};

export default ResultWidgetLegend;
