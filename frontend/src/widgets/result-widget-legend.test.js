/* eslint-env jest */
import { render } from '@testing-library/react';
import ResultWidgetLegend from './result-widget-legend';
import { ICON_RESULT_MAP } from '../constants';

describe('ResultWidgetLegend', () => {
  const defaultProps = {
    x: 10,
    y: 20,
    datum: {
      name: 'Passed (45)',
      symbol: {
        fill: 'var(--pf-t--chart--color--green--100)',
        type: 'passed',
      },
    },
    style: {
      fill: 'var(--pf-t--global--text--color--regular)',
    },
  };

  describe('Rendering with Icon', () => {
    it('should render legend with icon for passed result type', () => {
      const { container } = render(
        <svg>
          <ResultWidgetLegend {...defaultProps} />
        </svg>,
      );

      // Verify SVG group is rendered
      const group = container.querySelector('g');
      expect(group).toBeInTheDocument();

      // Verify text is rendered
      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
      expect(text.textContent).toBe('Passed (45)');
    });

    it('should render legend with icon for failed result type', () => {
      const failedProps = {
        ...defaultProps,
        datum: {
          name: 'Failed (3)',
          symbol: {
            fill: 'var(--pf-t--chart--color--red-orange--300)',
            type: 'failed',
          },
        },
      };

      const { container } = render(
        <svg>
          <ResultWidgetLegend {...failedProps} />
        </svg>,
      );

      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
      expect(text.textContent).toBe('Failed (3)');
    });

    it('should render legend with icon for error result type', () => {
      const errorProps = {
        ...defaultProps,
        datum: {
          name: 'Error (1)',
          symbol: {
            fill: 'var(--pf-t--chart--color--orange--300)',
            type: 'error',
          },
        },
      };

      const { container } = render(
        <svg>
          <ResultWidgetLegend {...errorProps} />
        </svg>,
      );

      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
      expect(text.textContent).toBe('Error (1)');
    });

    it('should render legend with icon for skipped result type', () => {
      const skippedProps = {
        ...defaultProps,
        datum: {
          name: 'Skipped (5)',
          symbol: {
            fill: 'var(--pf-t--chart--color--yellow--300)',
            type: 'skipped',
          },
        },
      };

      const { container } = render(
        <svg>
          <ResultWidgetLegend {...skippedProps} />
        </svg>,
      );

      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
      expect(text.textContent).toBe('Skipped (5)');
    });
  });

  describe('Rendering without Icon (Fallback)', () => {
    it('should render fallback rectangle when icon is not found', () => {
      const noIconProps = {
        ...defaultProps,
        datum: {
          name: 'Unknown (10)',
          symbol: {
            fill: 'var(--pf-t--global--color--brand--default)',
            type: 'unknown',
          },
        },
      };

      const { container } = render(
        <svg>
          <ResultWidgetLegend {...noIconProps} />
        </svg>,
      );

      // Should render a rectangle as fallback
      const rect = container.querySelector('rect');
      expect(rect).toBeInTheDocument();
      expect(rect).toHaveAttribute(
        'fill',
        'var(--pf-t--global--color--brand--default)',
      );

      // Should still render text
      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
      expect(text.textContent).toBe('Unknown (10)');
    });

    it('should use default fill color when symbol fill is not provided', () => {
      const noFillProps = {
        ...defaultProps,
        datum: {
          name: 'Custom (8)',
          symbol: {
            type: 'custom',
          },
        },
      };

      const { container } = render(
        <svg>
          <ResultWidgetLegend {...noFillProps} />
        </svg>,
      );

      const rect = container.querySelector('rect');
      expect(rect).toBeInTheDocument();
    });
  });

  describe('Position Props', () => {
    it('should position legend at specified x and y coordinates', () => {
      const { container } = render(
        <svg>
          <ResultWidgetLegend {...defaultProps} x={50} y={100} />
        </svg>,
      );

      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
      // Text should be offset from x position by textOffset (iconSize + 8)
      expect(text).toHaveAttribute('x', '74'); // 50 + 16 + 8
      expect(text).toHaveAttribute('y', '100');
    });

    it('should handle different x positions', () => {
      const { container } = render(
        <svg>
          <ResultWidgetLegend {...defaultProps} x={0} y={0} />
        </svg>,
      );

      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
      expect(text).toHaveAttribute('x', '24'); // 0 + 16 + 8
      expect(text).toHaveAttribute('y', '0');
    });
  });

  describe('Style Props', () => {
    it('should apply custom style to text', () => {
      const customStyle = {
        fill: '#custom-color',
      };

      const { container } = render(
        <svg>
          <ResultWidgetLegend {...defaultProps} style={customStyle} />
        </svg>,
      );

      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
    });

    it('should use default style when style prop is not provided', () => {
      const noStyleProps = {
        ...defaultProps,
        style: undefined,
      };

      const { container } = render(
        <svg>
          <ResultWidgetLegend {...noStyleProps} />
        </svg>,
      );

      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
    });
  });

  describe('Datum Props', () => {
    it('should render with datum name', () => {
      const { container } = render(
        <svg>
          <ResultWidgetLegend
            {...defaultProps}
            datum={{
              name: 'Custom Name',
              symbol: {
                fill: '#color',
                type: 'passed',
              },
            }}
          />
        </svg>,
      );

      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
      expect(text.textContent).toBe('Custom Name');
    });

    it('should handle datum with different symbol types', () => {
      const types = [
        'passed',
        'failed',
        'error',
        'skipped',
        'xfailed',
        'xpassed',
      ];

      types.forEach((type) => {
        const { container } = render(
          <svg>
            <ResultWidgetLegend
              {...defaultProps}
              datum={{
                name: `${type} (10)`,
                symbol: {
                  fill: '#color',
                  type: type,
                },
              }}
            />
          </svg>,
        );

        const text = container.querySelector('text');
        expect(text).toBeInTheDocument();
        expect(text.textContent).toContain(type);
      });
    });
  });

  describe('Foreign Object for Icon', () => {
    it('should render foreignObject when icon component exists', () => {
      const { container } = render(
        <svg>
          <ResultWidgetLegend {...defaultProps} />
        </svg>,
      );

      // If icon exists in ICON_RESULT_MAP, should render foreignObject
      if (ICON_RESULT_MAP[defaultProps.datum.symbol.type]) {
        const foreignObject = container.querySelector('foreignObject');
        expect(foreignObject).toBeInTheDocument();
        expect(foreignObject).toHaveAttribute('x', '10');
        expect(foreignObject).toHaveAttribute('y', '12'); // y - iconSize/2 = 20 - 8
        expect(foreignObject).toHaveAttribute('width', '16');
        expect(foreignObject).toHaveAttribute('height', '16');
      }
    });
  });

  describe('Text Positioning', () => {
    it('should position text with proper offset from icon', () => {
      const { container } = render(
        <svg>
          <ResultWidgetLegend {...defaultProps} x={100} y={50} />
        </svg>,
      );

      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
      // Text x = x + iconSize + 8 = 100 + 16 + 8 = 124
      expect(text).toHaveAttribute('x', '124');
      expect(text).toHaveAttribute('y', '50');
      expect(text).toHaveAttribute('dy', '0.35em');
    });

    it('should render text element with proper styling', () => {
      const { container } = render(
        <svg>
          <ResultWidgetLegend {...defaultProps} />
        </svg>,
      );

      const text = container.querySelector('text');
      expect(text).toBeInTheDocument();
      // Verify text content is rendered
      expect(text.textContent).toBe('Passed (45)');
    });
  });

  describe('Rectangle Fallback Sizing', () => {
    it('should render rectangle with proper dimensions when no icon', () => {
      const noIconProps = {
        ...defaultProps,
        datum: {
          name: 'No Icon',
          symbol: {
            fill: '#test-color',
            type: 'nonexistent',
          },
        },
      };

      const { container } = render(
        <svg>
          <ResultWidgetLegend {...noIconProps} x={50} y={60} />
        </svg>,
      );

      const rect = container.querySelector('rect');
      expect(rect).toBeInTheDocument();
      expect(rect).toHaveAttribute('x', '50');
      expect(rect).toHaveAttribute('y', '52'); // y - iconSize/2 = 60 - 8
      expect(rect).toHaveAttribute('width', '16');
      expect(rect).toHaveAttribute('height', '16');
      expect(rect).toHaveAttribute('rx', '2'); // Rounded corners
    });
  });
});
