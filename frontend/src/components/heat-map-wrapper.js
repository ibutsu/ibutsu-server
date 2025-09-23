import PropTypes from 'prop-types';
import HeatMap from 'react-heatmap-grid';

/**
 * Wrapper component for react-heatmap-grid to eliminate defaultProps warnings
 *
 * The react-heatmap-grid@0.9.1 library internally uses defaultProps which triggers
 * React warnings about deprecated defaultProps in function components. This wrapper
 * component uses JavaScript default parameters instead of defaultProps to eliminate
 * the warning while maintaining the same functionality.
 *
 * Warning resolved: "Support for defaultProps will be removed from function components
 * in a future major release. Use JavaScript default parameters instead."
 *
 * TODO: Remove this component when react-heatmap-grid updates or we replace it
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
  return (
    <HeatMap
      xLabels={xLabels}
      yLabels={yLabels}
      yLabelWidth={yLabelWidth}
      yLabelTextAlign={yLabelTextAlign}
      data={data}
      squares={squares}
      cellStyle={cellStyle}
      cellRender={cellRender}
      title={title}
      onClick={onClick}
      {...otherProps}
    />
  );
};

HeatMapWrapper.propTypes = {
  xLabels: PropTypes.array,
  yLabels: PropTypes.array,
  yLabelWidth: PropTypes.number,
  yLabelTextAlign: PropTypes.string,
  data: PropTypes.array,
  squares: PropTypes.bool,
  cellStyle: PropTypes.func,
  cellRender: PropTypes.func,
  title: PropTypes.func,
  onClick: PropTypes.func,
};

export default HeatMapWrapper;
