import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
  ChipGroup,
  PageSection,
  PageSectionVariants,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  Text,
  TextContent,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  TextInput
} from '@patternfly/react-core';

import { TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import {
  buildParams,
  getFilterMode,
  getOperationMode,
  getOperationsFromField,
  getSpinnerRow,
  parseFilter,
  resultToRow
} from './utilities';
import { FilterTable, MultiValueInput } from './components';
import { OPERATIONS, RESULT_FIELDS } from './constants';
import { IbutsuContext } from './services/context';

export class ResultList extends React.Component {
  static contextType = IbutsuContext;

  static propTypes = {
    location: PropTypes.object,
    navigate: PropTypes.func,
    eventEmitter: PropTypes.object,
    params: PropTypes.object,
  };

  constructor (props) {
    super(props);
    // TODO just use props.params when converting to funcational component
    const params = new URLSearchParams(props.location.search);
    let page = 1, pageSize = 20, filters = {};
    if (params.toString() !== '') {
      for(let pair of params) {
        if (pair[0] === 'page') {
          page = parseInt(pair[1]);
        }
        else if (pair[0] === 'pageSize') {
          pageSize = parseInt(pair[1]);
        }
        else {
          const combo = parseFilter(pair[0]);
          filters[combo['key']] = {
            'op': combo['op'],
            'val': pair[1]
          };
        }
      }
    }
    this.state = {
      columns: ['Test', 'Run', 'Result', 'Duration', 'Started'],
      rows: [getSpinnerRow(5)],
      runs: [],
      filteredRuns: [],
      page: page,
      pageSize: pageSize,
      totalItems: 0,
      totalPages: 0,
      filters: filters,
      fieldSelection: null,
      filteredfieldOptions: RESULT_FIELDS,
      fieldOptions: RESULT_FIELDS,
      isFieldOpen: false,
      fieldInputValue: '',
      fieldFilterValue: '',
      operationSelection: 'eq',
      isOperationOpen: false,
      textFilter: '',
      runSelection: null,
      isRunOpen: false,
      runInputValue: '',
      runFilterValue: '',
      resultSelection: null,
      isResultOpen: false,
      boolSelection: null,
      isBoolOpen: false,
      isError: false,
      isEmpty: false,
      inValues: []
    };
    props.eventEmitter.on('projectChange', () => {
      this.getResults();
    });
  }

  onFieldToggle = () => {
    this.setState({isFieldOpen: !this.state.isFieldOpen});
  };

  onFieldSelect = (_event, selection) => {
    const fieldFilterValue = this.state.fieldFilterValue;
    if (selection == `Create "${fieldFilterValue}"`) {
      this.setState({
        filteredfieldOptions: [...this.state.fieldOptions, fieldFilterValue],
        fieldSelection: fieldFilterValue,
        fieldInputValue: fieldFilterValue,
        operationSelection: 'eq',
      });
    }
    else {
      this.setState({
        fieldSelection: selection,
        fieldInputValue: selection,
        isFieldOpen: false,
        operationSelection: 'eq',
      });
    }
  };

  onFieldTextInputChange = (_event, value) => {
    this.setState({fieldInputValue: value});
    this.setState({fieldFilterValue: value});
  };

  onFieldClear = () => {
    this.setState({
      fieldSelection: null,
      fieldInputValue: '',
      fieldFilterValue: ''
    });
  };

  onFieldCreate = newValue => {
    this.setState({filteredfieldOptions: [...this.state.filteredfieldOptions, newValue]});
  };

  onOperationToggle = () => {
    this.setState({isOperationOpen: !this.state.isOperationOpen});
  };

  onOperationSelect = (event, selection) => {
    this.setState({
      operationSelection: selection,
      isOperationOpen: false,
      resultSelection: null,
      runSelection: null,
      boolSelection: null,
    });
  };

  onOperationClear = () => {
    this.setState({
      operationSelection: null,
      isOperationOpen: false
    });
  };

  onTextChanged = newValue => {
    this.setState({textFilter: newValue});
  };

  onRunToggle = () => {
    this.setState({isRunOpen: !this.state.isRunOpen});
  };

  onRunSelect = (_event, selection) => {
    const operationMode = getOperationMode(this.state.operationSelection);
    if (operationMode !== 'multi') {
      this.setState({
        runSelection: selection,
        runInputValue: selection,
        runFilterValue: '',
        isRunOpen: false
      });
    }
    else {
      const runSelection = this.state.runSelection || [];
      if (runSelection.includes(selection)) {
        this.setState({runSelection: runSelection.filter(item => item !== selection)});
      }
      else {
        this.setState({runSelection: [...runSelection, selection]});
      }
    }
  };

  onRunTextInputChange = (_event, value) => {
    this.setState({runInputValue: value});
    this.setState({runFilterValue: value});
  };

  onRunClear = () => {
    this.setState({
      runSelection: null,
      runInputValue: '',
      runFilterValue: ''
    });
  };

  onBoolSelect = (_event, selection) => {
    this.setState({
      boolSelection: selection,
      isBoolOpen: false
    });
  };

  onBoolToggle = () => {
    this.setState({isBoolOpen: !this.state.isBoolOpen});
  };

  onBoolClear = () => {
    this.setState({
      boolSelection: null,
      isBoolOpen: false
    });
  };

  onResultToggle = () => {
    this.setState({isResultOpen: !this.state.isResultOpen});
  };

  onResultSelect = (_event, selection) => {
    const operationMode = getOperationMode(this.state.operationSelection);
    if (operationMode !== 'multi') {
      this.setState({
        resultSelection: selection,
        isResultOpen: false
      });
    }
    else {
      const resultSelection = this.state.resultSelection || [];
      if (resultSelection.includes(selection)) {
        this.setState({resultSelection: resultSelection.filter(item => item !== selection)});
      }
      else {
        this.setState({resultSelection: [...resultSelection, selection]});
      }
    }
  };

  onResultClear = () => {
    this.setState({
      resultSelection: null,
      isResultOpen: false
    });
  };

  onInValuesChange = (values) => {
    this.setState({inValues: values});
  };

  applyFilter = () => {
    const field = this.state.fieldSelection;
    const operator = this.state.operationSelection;
    const filterMode = getFilterMode(field);
    const operationMode = getOperationMode(operator);
    let value = this.state.textFilter.trim();
    if (filterMode === 'result' && operationMode !== 'bool') {
      value = (operationMode === 'multi') ? this.state.resultSelection?.join(';') : this.state.resultSelection;
    }
    else if (filterMode === 'run' && operationMode !== 'bool') {
      value = (operationMode === 'multi') ? this.state.runSelection?.join(';') : this.state.runSelection;
    }
    else if (operationMode === 'multi') {
      // translate list to ;-separated string for BE
      value = this.state.inValues.map(item => item.trim()).join(';');
    }
    else if (operationMode === 'bool') {
      value = this.state.boolSelection;
    }
    this.updateFilters(field, operator, value, () => {
      this.updateUrl();
      this.getResults();
      this.setState({
        fieldSelection: null,
        fieldInputValue: '',
        fieldFilterValue: '',
        runInputValue: '',
        operationSelection: 'eq',
        textFilter: '',
        resultSelection: null,
        runSelection: null,
        boolSelection: null,
        inValues: []
      });
    });
  };

  applyReport = () => {
    this.props.navigate('/project/' + this.props.params.project_id + '/reports?' + buildParams(this.state.filters).join('&'));
  };

  updateFilters (name, operator, value, callback) {
    let filters = this.state.filters;
    if (!value) {
      delete filters[name];
    }
    else {
      filters[name] = {'op': operator, 'val': value};
    }
    this.setState({filters: filters, page: 1}, callback);
  }

  setFilter = (field, value) => {
    this.updateFilters(field, 'eq', value, () => {
      this.updateUrl();
      this.getResults();
      this.setState({
        fieldSelection: null,
        operationSelection: 'eq',
        textFilter: '',
        resultSelection: null,
        runSelection: null,
        boolSelection: null,
        inValues: []
      });
    });
  };

  removeFilter = id => {
    this.updateFilters(id, null, null, () => {
      this.updateUrl();
      this.setState({page: 1}, this.getResults);
    });
  };

  clearFilters = () => {
    this.setState({
      filters: [],
      page: 1,
      pageSize: 20,
      fieldSelection: null,
      operationSelection: 'eq',
      textFilter: '',
      resultSelection: null,
      runSelection: null,
      boolSelection: null,
      inValues: []
    }, function () {
      this.updateUrl();
      this.getResults();
    });
  };

  updateUrl () {
    let params = buildParams(this.state.filters);
    params.push('page=' + this.state.page);
    params.push('pageSize=' + this.state.pageSize);
    this.props.navigate('?' + params.join('&'));
  }

  setPage = (_event, pageNumber) => {
    this.setState({page: pageNumber}, () => {
      this.updateUrl();
      this.getResults();
    });
  };

  setPageSize = (_event, perPage) => {
    this.setState({pageSize: perPage}, () => {
      this.updateUrl();
      this.getResults();
    });
  };

  getResults () {
    // Show a spinner
    this.setState({rows: [getSpinnerRow(5)], isEmpty: false, isError: false});
    let params = {filter: []};
    let filters = this.state.filters;
    const { primaryObject } = this.context;
    if (primaryObject) {
      filters['project_id'] = {'val': primaryObject.id, 'op': 'eq'};
    }
    else if (Object.prototype.hasOwnProperty.call(filters, 'project_id')) {
      delete filters['project_id'];
    }
    params['estimate'] = true;  // use a count estimate for this page
    params['pageSize'] = this.state.pageSize;
    params['page'] = this.state.page;
    // Convert UI filters to API filters
    for (let key in filters) {
      if (Object.prototype.hasOwnProperty.call(filters, key) && !!filters[key]) {
        const val = filters[key]['val'];
        const op = OPERATIONS[filters[key]['op']];
        params.filter.push(key + op + val);
      }
    }
    HttpClient.get([Settings.serverUrl, 'result'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
        rows: data.results.map((result) => resultToRow(result, this.setFilter)),
        page: data.pagination.page,
        pageSize: data.pagination.pageSize,
        totalItems: data.pagination.totalItems,
        totalPages: data.pagination.totalPages,
        isEmpty: data.pagination.totalItems === 0
      }))
      .catch((error) => {
        console.error('Error fetching result data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
  }

  getRuns () {
    HttpClient.get([Settings.serverUrl, 'run'], {pageSize: 500, estimate: true})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        const runs = data.runs.map((run) => run.id);
        this.setState({runs: runs, filteredRuns: runs});
      });
  }

  componentDidMount () {
    this.getResults();
    this.getRuns();
  }

  componentDidUpdate (prevProps, prevState) {
    if (
      prevState.fieldFilterValue !== this.state.fieldFilterValue
    ) {
      let newSelectOptionsField = this.state.fieldOptions;
      if (this.state.fieldInputValue) {
        newSelectOptionsField = this.state.fieldOptions.filter(menuItem =>
          menuItem.toLowerCase().includes(this.state.fieldFilterValue.toLowerCase())
        );
        if (newSelectOptionsField.length !== 1 && !newSelectOptionsField.includes(this.state.fieldFilterValue) ) {
          newSelectOptionsField.push(`Create "${this.state.fieldFilterValue}"`);
        }

        if (!this.state.isFieldOpen) {
          this.setState({ isFieldOpen: true });
        }
      }

      this.setState({
        filteredfieldOptions: newSelectOptionsField,
      });
    }

    if (
      prevState.runFilterValue !== this.state.runFilterValue
    ) {
      let newSelectOptionsRun = this.state.runs;
      if (this.state.runInputValue) {
        newSelectOptionsRun = this.state.runs.filter(menuItem =>
          menuItem.toLowerCase().includes(this.state.runFilterValue.toLowerCase())
        );

        if (!this.state.isRunOpen) {
          this.setState({ isRunOpen: true });
        }
      }

      this.setState({
        filteredRuns: newSelectOptionsRun,
      });
    }
  }

  render () {
    document.title = 'Test Results | Ibutsu';
    const {
      columns,
      rows,
      filteredRuns,
      fieldSelection,
      isFieldOpen,
      filteredfieldOptions,
      fieldInputValue,
      operationSelection,
      isOperationOpen,
      textFilter,
      runSelection,
      isRunOpen,
      runInputValue,
      resultSelection,
      isResultOpen,
      boolSelection,
      isBoolOpen,
    } = this.state;
    const filterMode = getFilterMode(fieldSelection);
    const operationMode = getOperationMode(operationSelection);
    const operations = getOperationsFromField(fieldSelection);

    const fieldToggle = toggleRef => (
      <MenuToggle
        variant="typeahead"
        aria-label="Typeahead creatable menu toggle"
        onClick={this.onFieldToggle}
        isExpanded={this.state.isFieldOpen}
        isFullWidth
        innerRef={toggleRef}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={fieldInputValue}
            onClick={this.onFieldToggle}
            onChange={this.onFieldTextInputChange}
            id="create-typeahead-select-input"
            autoComplete="off"
            placeholder="Select a field"
            role="combobox"
            isExpanded={this.state.isFieldOpen}
            aria-controls="select-create-typeahead-listbox"
          />
          <TextInputGroupUtilities>
            {!!fieldInputValue && (
              <Button
                variant="plain"
                onClick={() => {this.onFieldClear();}}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    );
    const operationToggle = toggleRef => (
      <MenuToggle
        onClick={this.onOperationToggle}
        isExpanded={isOperationOpen}
        isFullWidth
        ref={toggleRef}
      >
        {this.state.operationSelection}
      </MenuToggle>
    );
    const boolToggle = toggleRef => (
      <MenuToggle
        onClick={this.onBoolToggle}
        isExpanded={this.state.isBoolOpen}
        isFullWidth
        ref={toggleRef}
        style={{maxHeight: '36px'}}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={boolSelection}
            onClick={this.onBoolToggle}
            autoComplete="off"
            placeholder="Select True/False"
            role="combobox"
            isExpanded={this.state.isBoolOpen}
          />
          <TextInputGroupUtilities>
            {!!boolSelection && (
              <Button variant="plain" onClick={() => {
                this.onBoolClear();
              }} aria-label="Clear input value">
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    );
    const resultToggle = toggleRef => (
      <MenuToggle
        onClick={this.onResultToggle}
        isExpanded={this.state.isResultOpen}
        isFullWidth
        placeholder="Select a result"
        ref={toggleRef}
      >
        {resultSelection ? resultSelection : 'Select a result'}
      </MenuToggle>
    );
    const resultMultiToggle = toggleRef => (
      <MenuToggle
        variant="typeahead"
        onClick={this.onResultToggle}
        isExpanded={this.state.isResultOpen}
        isFullWidth
        placeholder="Select a result"
        ref={toggleRef}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            onClick={this.onResultToggle}
            isExpanded={this.state.isResultOpen}
            placeholder="Select 1 or multiple results"
          >
            <ChipGroup aria-label="Current selections">
              {resultSelection?.map((selection, index) => (
                <Chip
                  key={index}
                  onClick={ev => {
                    ev.stopPropagation();
                    this.onResultSelect(ev, selection);
                  }}
                >
                  {selection}
                </Chip>
              ))}
            </ChipGroup>
          </TextInputGroupMain>
          <TextInputGroupUtilities>
            {!!resultSelection && (
              <Button
                variant="plain"
                onClick={() => {this.onResultClear();}}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    );
    const runToggle = toggleRef => (
      <MenuToggle
        variant="typeahead"
        onClick={this.onRunToggle}
        isExpanded={isRunOpen}
        isFullWidth
        innerRef={toggleRef}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={runInputValue}
            onClick={this.onRunToggle}
            onChange={this.onRunTextInputChange}
            autoComplete="off"
            placeholder="Select a run"
            role="combobox"
            isExpanded={isRunOpen}
          />
          <TextInputGroupUtilities>
            {!!runInputValue && (
              <Button variant="plain" onClick={() => {
                this.onRunClear();
              }} aria-label="Clear input value">
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    );
    const runMultiToggle = toggleRef => (
      <MenuToggle
        variant="typeahead"
        onClick={this.onRunToggle}
        isExpanded={isRunOpen}
        isFullWidth
        innerRef={toggleRef}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={runInputValue}
            onClick={this.onRunToggle}
            onChange={this.onRunTextInputChange}
            autoComplete="off"
            placeholder="Select 1 or multiple runs"
            role="combobox"
            isExpanded={isRunOpen}
          >
            <ChipGroup aria-label="Current selections">
              {runSelection?.map((selection, index) => (
                <Chip
                  key={index}
                  onClick={ev => {
                    ev.stopPropagation();
                    this.onRunSelect(ev, selection);
                  }}
                >
                  {selection}
                </Chip>
              ))}
            </ChipGroup>
          </TextInputGroupMain>
          <TextInputGroupUtilities>
            {runSelection?.length > 0 && (
              <Button variant="plain" onClick={() => {
                this.onRunClear();
              }} aria-label="Clear input value">
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    );
    const filters = [
      <Select
        id="typeahead-select"
        selected={fieldSelection}
        isOpen={isFieldOpen}
        onSelect={this.onFieldSelect}
        key="field"
        onOpenChange={() => this.setState({isFieldOpen: false})}
        toggle={fieldToggle}
      >
        <SelectList  id="select-typeahead-listbox">
          {filteredfieldOptions.map((option, index) => (
            <SelectOption key={index} value={option}>
              {option}
            </SelectOption>
          ))}
        </SelectList>
      </Select>,
      <Select
        id="single-select"
        isOpen={isOperationOpen}
        selected={operationSelection}
        onSelect={this.onOperationSelect}
        onOpenChange={() => this.setState({isOperationOpen: false})}
        key="operation"
        toggle={operationToggle}
      >
        <SelectList>
          {Object.keys(operations).map((option, index) => (
            <SelectOption key={index} value={option}>
              {option}
            </SelectOption>
          ))}
        </SelectList>
      </Select>,
      <React.Fragment key="value">
        {(operationMode === 'bool') &&
        <Select
          id="single-select"
          isOpen={isBoolOpen}
          selected={boolSelection}
          onSelect={this.onBoolSelect}
          onOpenChange={() => this.setState({isBoolOpen: false})}
          toggle={boolToggle}
        >
          <SelectList>
            {['True', 'False'].map((option, index) => (
              <SelectOption key={index} value={option}>
                {option}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
        }
        {(filterMode === 'text' && operationMode === 'single') &&
          <TextInput type="text" id="textSelection" placeholder="Type in value" value={textFilter || ''} onChange={(_event, newValue) => this.onTextChanged(newValue)} style={{height: 'inherit'}}/>
        }
        {(filterMode === 'text' && operationMode === 'multi') &&
          <MultiValueInput onValuesChange={this.onInValuesChange} style={{height: 'inherit'}}/>
        }
        {(filterMode === 'run' && operationMode !== 'bool') &&
          <Select
            id="typeahead-select"
            isOpen={isRunOpen}
            selected={runSelection}
            onSelect={this.onRunSelect}
            onOpenChange={() => this.setState({isRun: false})}
            toggle={operationMode === 'multi' ? runMultiToggle : runToggle}
          >
            <SelectList>
              {filteredRuns.length === 0 && (
                <SelectOption isDisabled={true}>
                  {`No runs found for "${this.state.runFilterValue}"`}
                </SelectOption>
              )}
              {filteredRuns.map((option, index) => (
                <SelectOption key={index} value={option}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        }
        {(filterMode === 'result' && operationMode !== 'bool') &&
          <Select
            id="single-select"
            isOpen={isResultOpen}
            selected={resultSelection}
            onSelect={this.onResultSelect}
            onOpenChange={() => this.setState({isResultOpen: false})}
            toggle={operationMode === 'multi' ? resultMultiToggle : resultToggle}
          >
            <SelectList>
              {['passed', 'xpassed', 'failed', 'xfailed', 'skipped', 'error'].map((option, index) => (
                <SelectOption key={index} value={option}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>

          </Select>
        }
      </React.Fragment>
    ];
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    };
    return (
      <React.Fragment>
        <PageSection id="page" variant={PageSectionVariants.light}>
          <TextContent>
            <Text className="title" component="h1">Test results</Text>
          </TextContent>
        </PageSection>
        <PageSection className="pf-u-pb-0">
          <Card>
            <CardBody className="pf-u-p-0">
              <FilterTable
                columns={columns}
                rows={rows}
                filters={filters}
                activeFilters={this.state.filters}
                pagination={pagination}
                isEmpty={this.state.isEmpty}
                isError={this.state.isError}
                onApplyFilter={this.applyFilter}
                onRemoveFilter={this.removeFilter}
                onClearFilters={this.clearFilters}
                onApplyReport={this.applyReport}
                onSetPage={this.setPage}
                onSetPageSize={this.setPageSize}
                hideFilters={['project_id']}
              />
            </CardBody>
            <CardFooter>
              <Text className="disclaimer" component="h4">
                * Note: for performance reasons, the total number of items is an approximation.
                Use the API with &lsquo;estimate=false&rsquo; if you need an accurate count.
              </Text>
            </CardFooter>
          </Card>
        </PageSection>
      </React.Fragment>
    );
  }
}
