import { Bullseye, Spinner } from '@patternfly/react-core';
import PropTypes from 'prop-types';

/**
 * Shared loading spinner components for consistent loading UX across the application.
 * Use these instead of defining inline spinner components.
 */

/**
 * Full-page spinner for route-level loading states.
 * Centers the spinner in the full viewport height.
 */
export const PageSpinner = ({ ariaLabel = 'Loading page...' }) => (
  <Bullseye style={{ height: '100vh' }}>
    <Spinner size="xl" aria-label={ariaLabel} />
  </Bullseye>
);

PageSpinner.propTypes = {
  ariaLabel: PropTypes.string,
};

/**
 * Content spinner for lazy-loaded page content.
 * Uses a smaller minimum height suitable for content sections.
 */
export const ContentSpinner = ({ ariaLabel = 'Loading content...' }) => (
  <Bullseye style={{ minHeight: '200px' }}>
    <Spinner size="lg" aria-label={ariaLabel} />
  </Bullseye>
);

ContentSpinner.propTypes = {
  ariaLabel: PropTypes.string,
};

/**
 * Widget spinner for dashboard widget loading states.
 * Alias for ContentSpinner but semantically named for widget context.
 */
export const WidgetSpinner = ({ ariaLabel = 'Loading widget...' }) => (
  <Bullseye style={{ minHeight: '200px' }}>
    <Spinner size="lg" aria-label={ariaLabel} />
  </Bullseye>
);

WidgetSpinner.propTypes = {
  ariaLabel: PropTypes.string,
};
