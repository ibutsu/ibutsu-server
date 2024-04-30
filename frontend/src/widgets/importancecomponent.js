import React from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  Text
} from '@patternfly/react-core';

import {
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td
} from '@patternfly/react-table';

import { Link } from 'react-router-dom';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { WidgetHeader } from '../components/widget-components';

export class ImportanceComponentWidget extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    params: PropTypes.object,
    onDeleteClick: PropTypes.func,
    onEditClick: PropTypes.func
  }

  constructor(props) {
    super(props);
    this.title = props.title || 'Importance Component Widget';
    this.params = props.params || {};
    this.state = {
      data: {
        table_data: []
      },
      isLoading: true,
    };
  }

  getData = () => {
    this.setState({isLoading: true})
    HttpClient.get([Settings.serverUrl, 'widget', 'importance-component'], this.params)
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then(data => this.setState({data: data, isLoading: false}))
      .catch(error => {
        this.setState({dataError: true});
        console.log(error);
      });
  }

  componentDidMount() {
    this.getData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.params !== this.props.params) {
      this.params = this.props.params;
      this.getData();
    }
  }

  toPercent(num) {
    if (typeof(num) === 'number') {
      return Math.round(num * 100)
    }
    return num
  }

  render() {
    return (
      <Card>
        <WidgetHeader title={this.title} getDataFunc={this.getData} onEditClick={this.props.onEditClick} onDeleteClick={this.props.onDeleteClick}/>
        {(!this.state.dataError && this.state.isLoading) &&
        <CardBody>
          <Text component="h2">Loading ...</Text>
        </CardBody>
        }
        {(!this.state.dataError && !this.state.isLoading) &&
        <CardBody>
          {this.state.data.table_data.map((tdat) => (
            <>
              <Text key={tdat.component} component="h2">{tdat.component}</Text>
              <Table aria-label="importance-component-table" variant="compact">
                <Thead>
                  <Tr>
                    {["-", ...tdat.bnums].map((buildnum) => (
                      <Th key={buildnum}>{buildnum}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {tdat.importances.map((importance) => (
                  <Tr key={importance}>
                    <Text component="h2">{importance}</Text>
                    {tdat.bnums.map((buildnum) => (
                      <Td key={buildnum}><Link to={`/results?id[in]=${tdat.data[buildnum][importance]["result_list"].join(";")}`}>{this.toPercent(tdat.data[buildnum][importance]["percentage"])}</Link></Td>
                    ))}
                  </Tr>
                  ))}
                </Tbody>
              </Table>
            </>
          ))}
        </CardBody>
        }
      </Card>
    );
  }
}
