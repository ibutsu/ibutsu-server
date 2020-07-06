import React from 'react';
import PropTypes from 'prop-types';
import {
  Bullseye,
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  EmptyStateSecondaryActions,
  Title
} from '@patternfly/react-core';
import {
  ErrorCircleOIcon,
  SearchIcon
} from '@patternfly/react-icons';

export class TableEmptyState extends React.Component {
  static propTypes = {
    onClearFilters: PropTypes.func,
  }

  render() {
    return (
      <Bullseye>
        <EmptyState>
          <EmptyStateIcon icon={SearchIcon} />
          <Title headingLevel="h5" size="lg">No results found</Title>
          {!!this.props.onClearFilters &&
          <React.Fragment>
            <EmptyStateBody>
              No results match this filter criteria. Clear all filters to show results.
            </EmptyStateBody>
            <EmptyStateSecondaryActions>
              <Button variant="link" onClick={this.props.onClearFilters}>Clear all filters</Button>
            </EmptyStateSecondaryActions>
          </React.Fragment>
          }
        </EmptyState>
      </Bullseye>
    );
  }
}

export class TableErrorState extends React.Component {
  static propTypes = {
    onClearFilters: PropTypes.func,
  }

  render() {
    return (
      <Bullseye>
        <EmptyState>
          <EmptyStateIcon icon={ErrorCircleOIcon} />
          <Title headingLevel="h5" size="lg">Error occurred fetching results</Title>
          {!!this.props.onClearFilters &&
          <React.Fragment>
            <EmptyStateBody>
              An error occurred while fetching results. Try a different set of filters.
            </EmptyStateBody>
            <EmptyStateSecondaryActions>
              <Button variant="link" onClick={this.props.onClearFilters}>Clear all filters</Button>
            </EmptyStateSecondaryActions>
          </React.Fragment>
          }
        </EmptyState>
      </Bullseye>
    );
  }
}
