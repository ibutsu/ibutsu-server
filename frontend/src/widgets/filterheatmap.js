import { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  EmptyState,
  EmptyStateBody,
  Text,
  EmptyStateHeader,
} from '@patternfly/react-core';
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChartLineIcon,
} from '@patternfly/react-icons';
import { Link } from 'react-router-dom';
import HeatMap from 'react-heatmap-grid';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import WidgetHeader from '../components/widget-header';
import ParamDropdown from '../components/param-dropdown';
import { IbutsuContext } from '../components/contexts/ibutsuContext';

const FilterHeatmapWidget = ({
  title = 'Filter Heatmap',
  params,
  labelWidth = 200,
  hideDropdown,
  dropdownItems = [3, 5, 6, 7],
  includeAnalysisLink,
  onDeleteClick,
  onEditClick,
  type = 'filter',
}) => {
  const [data, setData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const [analysisViewId, setAnalysisViewId] = useState();

  const [countSkips, setCountSkips] = useState(
    params?.count_skips !== undefined ? params.count_skips : true,
  );
  const [builds, setBuilds] = useState(params?.builds);

  const context = useContext(IbutsuContext);
  const { primaryObject } = context;

  const getJenkinsAnalysisViewId = () => {
    HttpClient.get([Settings.serverUrl, 'widget-config'], {
      filter: 'widget=jenkins-analysis-view',
    })
      .then((response) => HttpClient.handleResponse(response))
      .then((responseData) => setAnalysisViewId(responseData.widgets[0]?.id))
      .catch((error) => console.error(error));
  };

  const getJenkinsAnalysisLink = () => {
    if (includeAnalysisLink && analysisViewId !== null) {
      return (
        <Link
          to={`/project/${primaryObject?.id || params?.project}/view/${analysisViewId}?job_name=${params?.job_name}#heatmap`}
        >
          <Button
            variant="secondary"
            title="See analysis"
            aria-label="See analysis"
            isInline
          >
            <ChartLineIcon />
          </Button>
        </Link>
      );
    } else {
      return null;
    }
  };

  useEffect(() => {
    // Fetch widget data
    setIsLoading(true);
    const widgetParams = {
      ...params,
      ...(builds ? { builds: builds } : {}),
    };

    if (widgetParams.builds && widgetParams.group_field) {
      if (type === 'jenkins' && widgetParams.job_name) {
        getJenkinsAnalysisViewId();
        HttpClient.get([Settings.serverUrl, 'widget', 'jenkins-heatmap'], {
          ...widgetParams,
          count_skips: countSkips, // only accepted for jenkins-heatmap type
        })
          .then((response) => HttpClient.handleResponse(response))
          .then((responseData) => {
            setData(responseData);
            setIsLoading(false);
          })
          .catch((error) => {
            setIsError(true);
            console.error(error);
          });
      } else {
        HttpClient.get(
          [Settings.serverUrl, 'widget', 'filter-heatmap'],
          widgetParams,
        )
          .then((response) => HttpClient.handleResponse(response))
          .then((responseData) => {
            setData(responseData);
            setIsLoading(false);
          })
          .catch((error) => {
            setIsError(true);
            console.error(error);
          });
      }
    }
  }, [countSkips, builds, params, params.count_skips, type]);

  const getCellStyle = (background, value, min, max, data, x) => {
    let style = { paddingTop: '-8.10811px' };
    if (x === 0 && !!value) {
      if (value[0] < 0) {
        style.background = 'var(--pf-v5-global--danger-color--100)';
      } else if (value[0] <= 1 && value[0] >= 0) {
        style.background = 'var(--pf-v5-global--warning-color--100)';
      } else if (value[0] > 1) {
        style.background = 'var(--pf-v5-global--success-color--100)';
      } else {
        style.background = 'none';
      }
    } else if (value) {
      if (value[0] < 50) {
        style.background = 'var(--pf-v5-global--danger-color--100)';
      } else if (value[0] <= 85 && value[0] >= 50) {
        style.background = 'var(--pf-v5-global--warning-color--100)';
      } else if (value[0] > 85) {
        style.background = 'var(--pf-v5-global--success-color--100)';
      } else if (isNaN(value[0])) {
        style.background = 'var(--pf-v5-global--info-color--100)';
      }
      // handle annotations, add a border for cells with annotations
      if (value[2]) {
        style.borderRight = 'solid 5px #01FFFF';
      }
    }
    return style;
  };

  const renderCell = (value) => {
    let contents = '';
    let style = { marginTop: '-4px' };
    if (!!value && value[1] === 0) {
      if (value[0] < 0) {
        contents = <ArrowDownIcon />;
      } else if (value[0] <= 1 && value[0] >= 0) {
        contents = <ArrowRightIcon />;
      } else if (value[0] === 100) {
        contents = <ArrowRightIcon />;
      } else if (value[0] > 1) {
        contents = <ArrowUpIcon />;
      }
    } else if (!!value && isNaN(value[0])) {
      contents = 'n/a';
    } else if (value) {
      if (value[2]) {
        let cellTitle = '';
        value[2].forEach((item) => {
          if (!!item.name && !!item.value) {
            cellTitle += item.name + ': ' + item.value + '\n';
          }
        });
        contents = (
          <p title={cellTitle}>
            <Link to={`/project/${primaryObject.id}/runs/${value[1]}#summary`}>
              {Math.floor(value[0])}
            </Link>
          </p>
        );
      } else {
        contents = (
          <Link to={`/project/${primaryObject.id}/runs/${value[1]}#summary`}>
            {Math.floor(value[0])}
          </Link>
        );
      }
    }
    return <div style={style}>{contents}</div>;
  };

  const xLabels = [<ChartLineIcon key={0} />];
  const yLabels = [];
  const renderData = [];
  let labels = [];
  if (data && data?.heatmap) {
    for (const key of Object.keys(data.heatmap)) {
      const newLabels = [];
      const values = data.heatmap[key];
      yLabels.push(
        <div key={key} title={key} className="ellipsis">
          {key}
        </div>,
      );
      renderData.push(values);
      values.forEach((item) => {
        if (!!item && item.length > 2 && !!item[3]) {
          newLabels.push(
            <Link
              to={`/project/${params?.project}/results?metadata.jenkins.build_number[eq]=${item[3]}&metadata.jenkins.job_name[eq]=${params?.job_name}`}
              key={item[3]}
            >
              {item[3]}
            </Link>,
          );
        }
      });
      if (newLabels.length > labels.length) {
        labels = newLabels;
      }
    }
  }

  labels.forEach((item) => xLabels.push(item));
  const jenkins_analysis_link = getJenkinsAnalysisLink();

  return (
    <Card>
      <WidgetHeader
        title={title || 'Filter Heatmap'}
        actions={[jenkins_analysis_link].filter((a) => a !== null)}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
      <CardBody data-id="heatmap" style={{ paddingTop: '0.5rem' }}>
        {!isError && isLoading && <Text component="h2">Loading ...</Text>}
        {!isError && !isLoading && renderData.length !== 0 && (
          <HeatMap
            xLabels={xLabels}
            yLabels={yLabels}
            yLabelWidth={labelWidth}
            yLabelTextAlign="left"
            data={renderData}
            squares
            cellStyle={getCellStyle}
            cellRender={renderCell}
            title={(value) => (value ? `${value[0]}` : '')}
          />
        )}
        {!isError && !isLoading && renderData.length === 0 && (
          <EmptyState>
            <EmptyStateHeader
              titleText="No data found for heatmap"
              headingLevel="h3"
            />
            <EmptyStateBody
              style={{ fontSize: '15px', fontFamily: 'sans-serif' }}
            >
              Ensure that you have correct job name and addition filters set
            </EmptyStateBody>
          </EmptyState>
        )}
        {isError && <p>Error fetching data</p>}
      </CardBody>
      {!hideDropdown && (
        <CardFooter>
          <ParamDropdown
            dropdownItems={dropdownItems}
            handleSelect={(value) => setBuilds(value)}
            defaultValue={builds}
            tooltip="Number of builds:"
          />
          {type === 'jenkins' && (
            <ParamDropdown
              dropdownItems={['Yes', 'No']}
              handleSelect={(value) => setCountSkips(value === 'Yes')}
              defaultValue={countSkips ? 'Yes' : 'No'}
              tooltip="Count skips as failure:"
            />
          )}
        </CardFooter>
      )}
    </Card>
  );
};

FilterHeatmapWidget.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  labelWidth: PropTypes.number,
  hideDropdown: PropTypes.bool,
  dropdownItems: PropTypes.array,
  includeAnalysisLink: PropTypes.bool,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
  type: PropTypes.string,
};

export default FilterHeatmapWidget;
