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
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { filtersToSearchParams } from '../../utilities';

const ActiveFilters = ({ activeFilters, onRemoveFilter, hideFilters }) => {
  const params = useParams();
  const navigate = useNavigate();

  const shownFilters = activeFilters?.filter(
    (filter) => !hideFilters?.includes(filter.field),
  );

  return (
    <Flex style={{ marginTop: '.75rem' }} direction={{ default: 'column' }}>
      {shownFilters?.length > 0 && (
        <Flex>
          <FlexItem>
            <Button
              onClick={() =>
                // TODO pass state?
                navigate({
                  pathname: `/project/${params.project_id}/reports`,
                  search: filtersToSearchParams(activeFilters),
                })
              }
              variant="tertiary"
              size="sm"
              type="button"
            >
              Transfer active filters to Report Builder
            </Button>
          </FlexItem>
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
};

export default ActiveFilters;
