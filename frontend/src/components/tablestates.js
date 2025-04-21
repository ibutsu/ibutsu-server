import React from 'react';
import PropTypes from 'prop-types';
import {
  Bullseye,
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateHeader,
  EmptyStateIcon,
} from '@patternfly/react-core';
import { ErrorCircleOIcon, SearchIcon } from '@patternfly/react-icons';

// TODO this could be one component with variable icons and textual content.

const TableEmptyState = (props) => {
  const { onClearFilters } = props;
  return (
    <Bullseye>
      <EmptyState>
        <EmptyStateHeader
          titleText="No results found"
          icon={<EmptyStateIcon icon={SearchIcon} />}
          headingLevel="h5"
        />
        <EmptyStateFooter>
          {!!onClearFilters && (
            <React.Fragment>
              <EmptyStateBody>
                No results match this filter criteria. Clear all filters to show
                results.
              </EmptyStateBody>
              <EmptyStateActions>
                <Button variant="link" onClick={onClearFilters}>
                  Clear all filters
                </Button>
              </EmptyStateActions>
            </React.Fragment>
          )}
        </EmptyStateFooter>
      </EmptyState>
    </Bullseye>
  );
};

TableEmptyState.propTypes = {
  onClearFilters: PropTypes.func,
};

const TableErrorState = (props) => {
  const { onClearFilters } = props;

  return (
    <Bullseye>
      <EmptyState>
        <EmptyStateHeader
          titleText="Error occurred fetching results"
          icon={<EmptyStateIcon icon={ErrorCircleOIcon} />}
          headingLevel="h5"
        />
        <EmptyStateFooter>
          {!!onClearFilters && (
            <React.Fragment>
              <EmptyStateBody>
                An error occurred while fetching results. Try a different set of
                filters.
              </EmptyStateBody>
              <EmptyStateActions>
                <Button variant="link" onClick={onClearFilters}>
                  Clear all filters
                </Button>
              </EmptyStateActions>
            </React.Fragment>
          )}
        </EmptyStateFooter>
      </EmptyState>
    </Bullseye>
  );
};

TableErrorState.propTypes = {
  onClearFilters: PropTypes.func,
};

export { TableEmptyState, TableErrorState };
