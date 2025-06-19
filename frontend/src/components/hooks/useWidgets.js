// Assisted by watsonx Code Assistant
import { useState, useEffect, useMemo, useContext } from 'react';
import { HttpClient } from '../../services/http';
import { KNOWN_WIDGETS } from '../../constants';
import { Settings } from '../../settings';
import { GridItem } from '@patternfly/react-core';
import {
  FilterHeatmapWidget,
  HEATMAP_TYPES,
} from '../../widgets/filterheatmap';
import GenericAreaWidget from '../../widgets/genericarea';
import GenericBarWidget from '../../widgets/genericbar';
import ImportanceComponentWidget from '../../widgets/importancecomponent';
import { IbutsuContext } from '../../components/contexts/ibutsuContext';
import ResultSummaryApex from '../../widgets/ResultSummaryApex';
import ResultAggregateApex from '../../widgets/ResultAggregateApex';
import RunAggregateApex from '../../widgets/RunAggregateApex';

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
        data?.widgets.forEach((widget) => {
          widget.params['project'] = primaryObject.id;
        });
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

  // Proxy this to set defaults?
  const DEFAULT_SIZES = Object.freeze({ sm: 12, md: 6, lg: 6, xl: 4, xl2: 4 });

  const gridItemSpan = Object.freeze({
    'jenkins-heatmap': { sm: 12, md: 6, lg: 6, xl: 6, xl2: 6 },
    'filter-heatmap': { sm: 12, md: 6, lg: 6, xl: 6, xl2: 6 },
    'run-aggregator': DEFAULT_SIZES,
    'result-summary': DEFAULT_SIZES,
    'result-aggregator': DEFAULT_SIZES,
    'jenkins-bar-chart': DEFAULT_SIZES,
    'jenkins-line-chart': DEFAULT_SIZES,
    'importance-component': DEFAULT_SIZES,
  });

  const widgetComponents = useMemo(() => {
    return widgets?.map((widget) => {
      if (KNOWN_WIDGETS.includes(widget.widget)) {
        return (
          <GridItem
            {...gridItemSpan[widget.widget]}
            key={`${widget.id}-${loadKey}`}
          >
            {widget.type === 'widget' &&
              widget.widget === 'jenkins-heatmap' && (
                <FilterHeatmapWidget
                  title={widget.title}
                  params={widget.params}
                  type={HEATMAP_TYPES.jenkins}
                  onDeleteClick={() => {
                    deleteCallback(widget.id);
                  }}
                  onEditClick={() => {
                    editCallback(widget.id);
                  }}
                />
              )}
            {widget.type === 'widget' && widget.widget === 'filter-heatmap' && (
              <FilterHeatmapWidget
                title={widget.title}
                params={widget.params}
                onDeleteClick={() => {
                  deleteCallback(widget.id);
                }}
                onEditClick={() => {
                  editCallback(widget.id);
                }}
              />
            )}
            {widget.type === 'widget' && widget.widget === 'run-aggregator' && (
              <RunAggregateApex
                title={widget.title}
                params={widget.params}
                horizontal={true}
                onDeleteClick={() => {
                  deleteCallback(widget.id);
                }}
                onEditClick={() => {
                  editCallback(widget.id);
                }}
              />
            )}
            {widget.type === 'widget' && widget.widget === 'result-summary' && (
              <ResultSummaryApex
                title="Test Results Summary"
                params={widget.params}
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
                  params={{
                    project: widget.params.project,
                    run_id: widget.params.run_id,
                    additional_filters: widget.params.additional_filters,
                  }}
                  chartType={widget.params.chart_type}
                  days={widget.params.days}
                  groupField={widget.params.group_field}
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
                  params={widget.params}
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
                  params={widget.params}
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
                  params={widget.params}
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
          </GridItem>
        );
      }
    });
  }, [deleteCallback, editCallback, gridItemSpan, loadKey, widgets]);

  return { widgets, widgetComponents };
};
