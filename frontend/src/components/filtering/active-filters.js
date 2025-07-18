import {
  Badge,
  Button,
  Flex,
  FlexItem,
  Card,
  CardHeader,
  CardBody,
  Divider,
} from '@patternfly/react-core';

import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { filtersToSearchParams, toTitleCase } from '../../utilities';
import { OPERATIONS } from '../../constants';
import { ChevronRightIcon, TimesCircleIcon } from '@patternfly/react-icons';

const BADGE_STYLE = {
  margin: '0.1rem',
  padding: '0.2rem',
  maxWidth: '100%',
};

const ActiveFilters = ({
  activeFilters,
  onRemoveFilter,
  hideFilters,
  transferTarget = 'reports',
}) => {
  const params = useParams();
  const navigate = useNavigate();

  const shownFilters = activeFilters?.filter((filter) => {
    // Debug: Check for malformed filter objects
    if (
      typeof filter === 'object' &&
      filter !== null &&
      (!filter?.field ||
        !filter?.operator ||
        filter?.value === null ||
        filter?.value === undefined)
    ) {
      console.warn('ActiveFilters: Malformed filter object detected:', filter);
      return false;
    }

    return (
      !hideFilters?.includes(filter?.field) &&
      filter?.field && // Ensure filter has a field
      filter?.operator && // Ensure filter has an operator
      filter?.value !== null &&
      filter?.value !== undefined // Ensure filter has a value
    );
  });

  // Get the proper button text based on transfer_target
  const transferText = useMemo(() => {
    switch (transferTarget) {
      case 'reports':
        return 'Transfer active filters to Report Builder';
      case undefined:
      case null:
        return null;
      default:
        return `Customize filters on the ${toTitleCase(transferTarget)} page`;
    }
  }, [transferTarget]);

  return (
    <Flex style={{ marginTop: '.75rem' }} direction={{ default: 'column' }}>
      {shownFilters?.length > 0 && (
        <Flex>
          {transferText && (
            <FlexItem>
              <Button
                icon={<ChevronRightIcon />}
                onClick={() =>
                  navigate({
                    pathname: `/project/${params.project_id}/${transferTarget}`,
                    search: filtersToSearchParams(
                      activeFilters.filter(
                        (filter) => filter?.field !== 'project_id',
                      ),
                    ).toString(),
                  })
                }
                variant="tertiary"
                size="sm"
                type="button"
              >
                {transferText}
              </Button>
            </FlexItem>
          )}
        </Flex>
      )}

      <Flex
        grow={{ default: 'grow' }}
        spaceItems={{ default: 'spaceItemsXs' }}
        direction={{ default: 'row' }}
      >
        {shownFilters?.map((activeFilter) => (
          <FlexItem key={activeFilter?.field}>
            <Card isCompact variant="outline" style={BADGE_STYLE}>
              <CardHeader style={BADGE_STYLE}>
                <Badge isRead style={BADGE_STYLE}>
                  {activeFilter?.field}
                </Badge>
                <Button
                  variant="plain"
                  onClick={() => onRemoveFilter(activeFilter?.field)}
                  aria-label={`Remove filter ${activeFilter?.field}`}
                  icon={<TimesCircleIcon />}
                  style={{
                    ...BADGE_STYLE,
                    float: 'right',
                  }}
                />
              </CardHeader>
              <Divider />
              <CardBody style={BADGE_STYLE}>
                <Badge isDisabled style={BADGE_STYLE}>
                  {OPERATIONS[activeFilter?.operator]?.opString ||
                    activeFilter?.operator}
                </Badge>
                <Badge isRead={false} style={BADGE_STYLE}>
                  <React.Fragment>
                    {activeFilter?.value ?? 'N/A'}
                  </React.Fragment>
                </Badge>
              </CardBody>
            </Card>
          </FlexItem>
        ))}
      </Flex>
    </Flex>
  );
};

ActiveFilters.propTypes = {
  activeFilters: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string,
      operator: PropTypes.string,
      value: PropTypes.any,
    }),
  ),
  onRemoveFilter: PropTypes.func,
  hideFilters: PropTypes.arrayOf(PropTypes.string),
  transferTarget: PropTypes.string,
};

export default ActiveFilters;
