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
        testa: "",
        testb: "",
        testc: "",
        sdatnew: []
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
          {this.state.data.sdatnew.map((sdat) => (
            <>
              <Text key={sdat.component} component="h2">{sdat.component}</Text>
              <Table aria-label="tttable" variant="compact">
                <Thead>
                  <Tr>
                    {["-", ...sdat.bnums].map((bnum) => (
                      <Th key={bnum}>{bnum}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {sdat.importances.map((importance) => (
                  <Tr key={importance}>
                    <Text component="h2">{importance}</Text>
                    {sdat.bnums.map((bnum) => (
                      <Td key={bnum}><Link to={`/results?id[in]=${sdat.data[bnum][importance]["result_list"].join(";")}`}>{sdat.data[bnum][importance]["percentage"]}</Link></Td>
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
