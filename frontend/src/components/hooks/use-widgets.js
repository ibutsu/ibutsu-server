// Assisted by watsonx Code Assistant
import {
  useState,
  useEffect,
  useMemo,
  useContext,
  lazy,
  Suspense,
} from 'react';
import PropTypes from 'prop-types';
import { HttpClient } from '../../utilities/http';
import { KNOWN_WIDGETS } from '../../constants';
import { Settings } from '../../pages/settings';
import { GridItem, Bullseye, Spinner } from '@patternfly/react-core';
import { IbutsuContext } from '../contexts/ibutsu-context';

// Lazy load widget components for code splitting
const FilterHeatmapWidget = lazy(() =>
  import('../../widgets/filter-heatmap').then((module) => ({
    default: module.FilterHeatmapWidget,
  })),
);
const HEATMAP_TYPES_PROMISE = import('../../widgets/filter-heatmap').then(
  (module) => module.HEATMAP_TYPES,
);

const GenericAreaWidget = lazy(() => import('../../widgets/generic-area'));
const GenericBarWidget = lazy(() => import('../../widgets/generic-bar'));
const ImportanceComponentWidget = lazy(
  () => import('../../widgets/importance-component'),
);
const ResultSummaryApex = lazy(
  () => import('../../widgets/result-summary-apex'),
);
const ResultAggregateApex = lazy(
  () => import('../../widgets/result-aggregate-apex'),
);
const RunAggregateApex = lazy(() => import('../../widgets/run-aggregate-apex'));

// Cache for HEATMAP_TYPES
let heatmapTypesCache = null;
const getHeatmapTypes = async () => {
  if (!heatmapTypesCache) {
    heatmapTypesCache = await HEATMAP_TYPES_PROMISE;
  }
  return heatmapTypesCache;
};

// Move constants outside component to prevent unnecessary re-renders
const DEFAULT_COLSPAN = Object.freeze({
  sm: 12,
  md: 6,
  lg: 6,
  xl: 4,
  xl2: 4,
});

const COLUMN_SPAN = Object.freeze({
  'jenkins-heatmap': { sm: 12, md: 6, lg: 6, xl: 6, xl2: 6 },
  'filter-heatmap': { sm: 12, md: 6, lg: 6, xl: 6, xl2: 6 },
  'run-aggregator': DEFAULT_COLSPAN,
  'result-summary': DEFAULT_COLSPAN,
  'result-aggregator': DEFAULT_COLSPAN,
  'jenkins-bar-chart': DEFAULT_COLSPAN,
  'jenkins-line-chart': DEFAULT_COLSPAN,
  'importance-component': DEFAULT_COLSPAN,
});

const DEFAULT_ROWSPAN = Object.freeze({
  smRowSpan: 1,
  mdRowSpan: 1,
  lgRowSpan: 1,
  xlRowSpan: 1,
  xl2RowSpan: 1,
});

const ROW_SPAN = Object.freeze({
  'jenkins-heatmap': DEFAULT_ROWSPAN,
  'filter-heatmap': DEFAULT_ROWSPAN,
  'run-aggregator': DEFAULT_ROWSPAN,
  'result-summary': DEFAULT_ROWSPAN,
  'result-aggregator': DEFAULT_ROWSPAN,
  'jenkins-bar-chart': DEFAULT_ROWSPAN,
  'jenkins-line-chart': DEFAULT_ROWSPAN,
  'importance-component': DEFAULT_ROWSPAN,
});

const WidgetSpinner = () => (
  <Bullseye style={{ minHeight: '200px' }}>
    <Spinner size="lg" aria-label="Loading widget..." />
  </Bullseye>
);

// Wrapper component for jenkins-heatmap that handles async HEATMAP_TYPES
const JenkinsHeatmapWrapper = ({
  title,
  params,
  onDeleteClick,
  onEditClick,
}) => {
  const [heatmapType, setHeatmapType] = useState(null);

  useEffect(() => {
    getHeatmapTypes().then((types) => setHeatmapType(types.jenkins));
  }, []);

  if (!heatmapType) {
    return <WidgetSpinner />;
  }

  return (
    <FilterHeatmapWidget
      title={title}
      params={params}
      type={heatmapType}
      onDeleteClick={onDeleteClick}
      onEditClick={onEditClick}
    />
  );
};

JenkinsHeatmapWrapper.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
};

export const useWidgets = ({
  dashboardId = null,
  editCallback = () => {},
  deleteCallback = () => {},
  loadKey,
}) => {
  const { primaryObject } = useContext(IbutsuContext);
  const [widgets, setWidgets] = useState([]);

  useEffect(() => {
    const getWidgets = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget-config'],
          { type: 'widget', filter: `dashboard_id=${dashboardId}` },
        );
        const data = await HttpClient.handleResponse(response);
        // Project parameter is now handled automatically during widget save/edit
        // No need to force it on all widgets here
        setWidgets(data?.widgets);
      } catch (error) {
        console.error(error);
      }
    };

    if (dashboardId) {
      const debouncer = setTimeout(() => {
        getWidgets();
      }, 80);
      return () => {
        clearTimeout(debouncer);
      };
    }
  }, [dashboardId, primaryObject, loadKey]);

  const widgetComponents = useMemo(() => {
    return widgets?.map((widget) => {
      if (KNOWN_WIDGETS.includes(widget.widget)) {
        // Add project parameter from widget config's project_id to params
        // This ensures widgets receive project context for API calls
        const widgetParams = {
          ...widget.params,
          ...(widget.project_id && { project: widget.project_id }),
        };
        return (
          <GridItem
            {...COLUMN_SPAN[widget.widget]}
            {...ROW_SPAN[widget.widget]}
            key={`${widget.id}-${loadKey}`}
          >
            <Suspense fallback={<WidgetSpinner />}>
              {widget.type === 'widget' &&
                widget.widget === 'jenkins-heatmap' && (
                  <JenkinsHeatmapWrapper
                    title={widget.title}
                    params={widgetParams}
                    onDeleteClick={() => {
                      deleteCallback(widget.id);
                    }}
                    onEditClick={() => {
                      editCallback(widget.id);
                    }}
                  />
                )}
              {widget.type === 'widget' &&
                widget.widget === 'filter-heatmap' && (
                  <FilterHeatmapWidget
                    title={widget.title}
                    params={widgetParams}
                    onDeleteClick={() => {
                      deleteCallback(widget.id);
                    }}
                    onEditClick={() => {
                      editCallback(widget.id);
                    }}
                  />
                )}
              {widget.type === 'widget' &&
                widget.widget === 'run-aggregator' && (
                  <RunAggregateApex
                    title={widget.title}
                    params={widgetParams}
                    horizontal={true}
                    onDeleteClick={() => {
                      deleteCallback(widget.id);
                    }}
                    onEditClick={() => {
                      editCallback(widget.id);
                    }}
                  />
                )}
              {widget.type === 'widget' &&
                widget.widget === 'result-summary' && (
                  <ResultSummaryApex
                    title="Test Results Summary"
                    params={widgetParams}
                    onEditClick={() => {
                      editCallback(widget.id);
                    }}
                    onDeleteClick={() => {
                      deleteCallback(widget.id);
                    }}
                  />
                )}
              {widget.type === 'widget' &&
                widget.widget === 'result-aggregator' && (
                  <ResultAggregateApex
                    title={widget.title}
                    params={widgetParams}
                    days={widgetParams.days}
                    groupField={widgetParams.group_field}
                    onDeleteClick={() => {
                      deleteCallback(widget.id);
                    }}
                    onEditClick={() => {
                      editCallback(widget.id);
                    }}
                  />
                )}
              {widget.type === 'widget' &&
                widget.widget === 'jenkins-line-chart' && (
                  <GenericAreaWidget
                    title={widget.title}
                    params={widgetParams}
                    yLabel="Execution time"
                    widgetEndpoint="jenkins-line-chart"
                    onDeleteClick={() => {
                      deleteCallback(widget.id);
                    }}
                    onEditClick={() => {
                      editCallback(widget.id);
                    }}
                  />
                )}
              {widget.type === 'widget' &&
                widget.widget === 'jenkins-bar-chart' && (
                  <GenericBarWidget
                    title={widget.title}
                    params={widgetParams}
                    barWidth={20}
                    horizontal={true}
                    hideDropdown={true}
                    widgetEndpoint="jenkins-bar-chart"
                    onDeleteClick={() => {
                      deleteCallback(widget.id);
                    }}
                    onEditClick={() => {
                      editCallback(widget.id);
                    }}
                  />
                )}
              {widget.type === 'widget' &&
                widget.widget === 'importance-component' && (
                  <ImportanceComponentWidget
                    title={widget.title}
                    params={widgetParams}
                    barWidth={20}
                    horizontal={true}
                    hideDropdown={true}
                    widgetEndpoint="importance-component"
                    onDeleteClick={() => {
                      deleteCallback(widget.id);
                    }}
                    onEditClick={() => {
                      editCallback(widget.id);
                    }}
                  />
                )}
            </Suspense>
          </GridItem>
        );
      }
    });
  }, [deleteCallback, editCallback, loadKey, widgets]);

  return { widgets, widgetComponents };
};
