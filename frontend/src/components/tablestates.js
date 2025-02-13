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
  EmptyStateIcon
} from '@patternfly/react-core';
import {
  ErrorCircleOIcon,
  SearchIcon
} from '@patternfly/react-icons';

export class TableEmptyState extends React.Component {
  static propTypes = {
    onClearFilters: PropTypes.func,
  };

  render () {
    return (
      <Bullseye>
        <EmptyState>
          <EmptyStateHeader titleText="No results found" icon={<EmptyStateIcon icon={SearchIcon} />} headingLevel="h5" />
          <EmptyStateFooter>
            {!!this.props.onClearFilters &&
            <React.Fragment>
              <EmptyStateBody>
                No results match this filter criteria. Clear all filters to show results.
              </EmptyStateBody>
              <EmptyStateActions>
                <Button variant="link" onClick={this.props.onClearFilters}>Clear all filters</Button>
              </EmptyStateActions>
            </React.Fragment>
            }
          </EmptyStateFooter>
        </EmptyState>
      </Bullseye>
    );
  }
}

export class TableErrorState extends React.Component {
  static propTypes = {
    onClearFilters: PropTypes.func,
  };

  render () {
    return (
      <Bullseye>
        <EmptyState>
          <EmptyStateHeader titleText="Error occurred fetching results" icon={<EmptyStateIcon icon={ErrorCircleOIcon} />} headingLevel="h5" />
          <EmptyStateFooter>
            {!!this.props.onClearFilters &&
            <React.Fragment>
              <EmptyStateBody>
                An error occurred while fetching results. Try a different set of filters.
              </EmptyStateBody>
              <EmptyStateActions>
                <Button variant="link" onClick={this.props.onClearFilters}>Clear all filters</Button>
              </EmptyStateActions>
            </React.Fragment>
            }
          </EmptyStateFooter>
        </EmptyState>
      </Bullseye>
    );
  }
}
