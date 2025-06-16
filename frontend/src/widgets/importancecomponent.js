import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardFooter, Text } from '@patternfly/react-core';

import {
	Thead,
	Th,
	Tbody,
	Tr,
	Td
} from '@patternfly/react-table';
import {
	Table
} from '@patternfly/react-table/deprecated';

import { Link } from 'react-router-dom';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import WidgetHeader from '../components/widget-header';
import ParamDropdown from '../components/param-dropdown';

const ImportanceComponentWidget = ({
  title,
  params,
  onDeleteClick,
  onEditClick,
}) => {
  const [tableData, setTableData] = useState([]);
  const [dataError, setDataError] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [countSkips, setCountSkips] = useState('No');

  const getData = useCallback(() => {
    setIsLoading(true);
    HttpClient.get(
      [Settings.serverUrl, 'widget', 'importance-component'],
      params,
    )
      .then((response) => {
        response = HttpClient.handleResponse(response, 'response');
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then((data) => {
        setTableData(data.table_data);
        setIsLoading(false);
        setDataError(false);
      })
      .catch((error) => {
        setDataError(true);
        console.error(error);
      });
  }, [params]);

  useEffect(() => {
    getData();
  }, [getData]);

  const onSkipSelect = (value) => {
    setCountSkips(value);
    params.count_skips = value;
    getData();
  };

  const toPercent = (num) => {
    if (typeof num === 'number') {
      return Math.round(num * 100);
    }
    return num;
  };

  return (
    <Card>
      <WidgetHeader
        title={title}
        getDataFunc={getData}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
      {!dataError && isLoading && (
        <CardBody>
          <Text component="h2">Loading ...</Text>
        </CardBody>
      )}
      {!dataError && !isLoading && (
        <CardBody>
          {tableData.map((tdat) => (
            <div key={tdat.component}>
              <Text key={tdat.component} component="h2">
                {tdat.component}
              </Text>
              <Table aria-label="importance-component-table" variant="compact">
                <Thead>
                  <Tr>
                    {['-', ...tdat.bnums].map((buildnum) => (
                      <Th key={buildnum}>{buildnum}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {tdat.importances.map((importance) => (
                    <Tr key={importance}>
                      <Td>{importance}</Td>
                      {tdat.bnums.map((buildnum) => (
                        <Td key={buildnum}>
                          <Link
                            to={
                              '/project/' +
                              params.project +
                              `/results?id[in]=${tdat.data[buildnum][importance]['result_list'].join(';')}`
                            }
                          >
                            {toPercent(
                              tdat.data[buildnum][importance]['percentage'],
                            )}
                          </Link>
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          ))}
        </CardBody>
      )}
      <CardFooter>
        <ParamDropdown
          dropdownItems={['Yes', 'No']}
          handleSelect={onSkipSelect}
          defaultValue={countSkips}
          tooltip="Count skips as failure:"
        />
      </CardFooter>
    </Card>
  );
};

ImportanceComponentWidget.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
};

export default ImportanceComponentWidget;
