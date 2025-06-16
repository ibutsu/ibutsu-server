import {
  Badge,
  Button,
  Chip,
  ChipGroup,
  Flex,
  FlexItem,
  Text,
} from '@patternfly/react-core';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { filtersToSearchParams, toTitleCase } from '../../utilities';
import { ChevronRightIcon } from '@patternfly/react-icons';

const ActiveFilters = ({
  activeFilters,
  onRemoveFilter,
  hideFilters,
  transferTarget = 'reports',
}) => {
  const params = useParams();
  const navigate = useNavigate();

  const shownFilters = activeFilters?.filter(
    (filter) => !hideFilters?.includes(filter.field),
  );

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
                onClick={() =>
                  navigate({
                    pathname: `/project/${params.project_id}/${transferTarget}`,
                    search: filtersToSearchParams(
                      activeFilters.filter(
                        (filter) => filter.field !== 'project_id',
                      ),
                    ),
                  })
                }
                variant="tertiary"
                size="sm"
                type="button"
              >
                {transferText}
                <ChevronRightIcon />
              </Button>
            </FlexItem>
          )}
        </Flex>
      )}

      <Flex direction={{ default: 'row' }}>
        {shownFilters?.map((activeFilter) => (
          <FlexItem spacer={{ default: 'spacerXs' }} key={activeFilter?.field}>
            <ChipGroup categoryName={activeFilter?.field}>
              <Chip
                badge={
                  <Badge isRead={true}>
                    {typeof activeFilter === 'object' && (
                      <React.Fragment>{activeFilter?.value}</React.Fragment>
                    )}
                    {typeof activeFilter !== 'object' && activeFilter}
                  </Badge>
                }
                onClick={() => onRemoveFilter(activeFilter?.field)}
              >
                <Text>{activeFilter?.operator}</Text>
              </Chip>
            </ChipGroup>
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
