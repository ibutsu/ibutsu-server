import { useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  EmptyState,
  EmptyStateBody,
  Content,
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
import { filtersToSearchParams } from '../utilities';
import { CHART_COLOR_MAP } from '../constants';

const HEATMAP_TYPES = {
  filter: 'filter-heatmap',
  jenkins: 'jenkins-heatmap',
};

const FilterHeatmapWidget = ({
  title,
  params,
  labelWidth = 200,
  hideDropdown,
  dropdownItems = [3, 5, 6, 7],
  onDeleteClick,
  onEditClick,
  type = HEATMAP_TYPES.filter,
}) => {
  const [data, setData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const [countSkips, setCountSkips] = useState(
    params?.count_skips !== undefined ? params.count_skips : true,
  );
  const [builds, setBuilds] = useState(params?.builds);
  const [analysisViewId, setAnalysisViewId] = useState(null);

  const context = useContext(IbutsuContext);
  const { primaryObject } = context;

  // Fetch the analysis view ID separately from the rendering
  useEffect(() => {
    const fetchId = async () => {
      if (type === HEATMAP_TYPES.jenkins) {
        try {
          const response = await HttpClient.get(
            [Settings.serverUrl, 'widget-config'],
            { filter: 'widget=jenkins-analysis-view' },
          );
          const responseData = await HttpClient.handleResponse(response);
          setAnalysisViewId(responseData.widgets[0]?.id || null);
        } catch (error) {
          console.error(error);
          setAnalysisViewId(null);
        }
      }
    };
    const debouncer = setTimeout(() => {
      fetchId();
    }, 50);
    return () => clearTimeout(debouncer);
  }, [type]);

  const jenkinsAnalysisLink = useMemo(() => {
    if (type === HEATMAP_TYPES.jenkins && analysisViewId !== null) {
      const searchString = new URLSearchParams(
        filtersToSearchParams([
          {
            field: 'job_name',
            operator: 'eq',
            value: params?.job_name,
          },
        ]),
      ).toString();
      return (
        <Link
          to={{
            pathname: `/project/${primaryObject?.id || params?.project}/view/${analysisViewId}`,
            search: searchString,
            hash: 'heatmap',
          }}
        >
          <Button
            icon={<ChartLineIcon />}
            variant="secondary"
            title="See analysis"
            aria-label="See analysis"
            isInline
          ></Button>
        </Link>
      );
    } else {
      return null;
    }
  }, [
    analysisViewId,
    params?.job_name,
    params?.project,
    primaryObject?.id,
    type,
  ]);

  useEffect(() => {
    // Fetch widget data
    setIsLoading(true);
    const widgetParams = {
      ...params,
      ...(builds ? { builds: builds } : {}),
    };

    const fetchWidget = async (type, apiParams) => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget', type],
          apiParams,
        );
        const responseData = await HttpClient.handleResponse(response);
        setData(responseData);
        setIsLoading(false);
        setIsError(false);
      } catch (error) {
        setIsError(true);
        setIsLoading(false);
        console.error('Error fetching heatmap data:', error);
      }
    };

    if (widgetParams.builds && widgetParams.group_field) {
      if (type === HEATMAP_TYPES.jenkins && widgetParams.job_name) {
        fetchWidget(HEATMAP_TYPES.jenkins, {
          ...widgetParams,
          count_skips: countSkips, // only accepted for jenkins-heatmap type
        });
      } else {
        fetchWidget(HEATMAP_TYPES.filter, widgetParams);
      }
    }
  }, [countSkips, builds, params, params.count_skips, type]);

  const getCellStyle = (background, value, min, max, data, x) => {
    let style = { paddingTop: '-8.10811px' };
    if (x === 0 && !!value) {
      if (value[0] < 0) {
        style.background = CHART_COLOR_MAP.failed;
      } else if (value[0] <= 1 && value[0] >= 0) {
        style.background = CHART_COLOR_MAP.skipped;
      } else if (value[0] > 1) {
        style.background = CHART_COLOR_MAP.passed;
      } else {
        style.background = CHART_COLOR_MAP.default;
      }
    } else if (value) {
      if (value[0] < 50) {
        style.background = CHART_COLOR_MAP.failed;
      } else if (value[0] <= 85 && value[0] >= 50) {
        style.background = CHART_COLOR_MAP.skipped;
      } else if (value[0] > 85) {
        style.background = CHART_COLOR_MAP.passed;
      } else if (isNaN(value[0])) {
        style.background = CHART_COLOR_MAP.default;
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
    // TODO The response from backend is keyed on incomplete job name, truncating at `/`
    // Update response to include full job name. Current use of the widget is with one job name only, and thus one entry in yLabels
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
          const newSearchParams = new URLSearchParams(
            filtersToSearchParams([
              {
                field: 'metadata.jenkins.build_number',
                operator: 'eq',
                value: item[3],
              },
              {
                field: 'metadata.jenkins.job_name',
                operator: 'eq',
                value: params?.job_name,
              },
            ]),
          );
          newLabels.push(
            <Link
              to={{
                pathname: `/project/${params?.project}/results`,
                search: newSearchParams.toString(),
              }}
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

  const titleMemo = useMemo(() => {
    if (title) {
      return title;
    }
    if (params?.job_name) {
      return `Heatmap for ${params.job_name}`;
    } else {
      return 'Heatmap';
    }
  }, [params.job_name, title]);

  return (
    <Card>
      <WidgetHeader
        title={titleMemo}
        actions={[jenkinsAnalysisLink].filter((a) => a !== null)}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
      <CardBody data-id="heatmap" style={{ paddingTop: '0.5rem' }}>
        {!isError && isLoading && <Content component="h2">Loading ...</Content>}
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
          <EmptyState headingLevel="h3" titleText="No data found for heatmap">
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
          {type === HEATMAP_TYPES.jenkins && (
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
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
  type: PropTypes.string,
};

export { FilterHeatmapWidget, HEATMAP_TYPES };
