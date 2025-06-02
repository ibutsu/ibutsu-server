// Assisted by watsonx Code Assistant
import { useState, useEffect, useMemo, useContext } from 'react';
import { HttpClient } from '../../services/http';
import { KNOWN_WIDGETS } from '../../constants';
import { Settings } from '../../settings';
import { GridItem } from '@patternfly/react-core';
import FilterHeatmapWidget from '../../widgets/filterheatmap';
import ResultAggregatorWidget from '../../widgets/resultaggregator';
import GenericAreaWidget from '../../widgets/genericarea';
import GenericBarWidget from '../../widgets/genericbar';
import ImportanceComponentWidget from '../../widgets/importancecomponent';
import ResultSummaryWidget from '../../widgets/resultsummary';
import { IbutsuContext } from '../../components/contexts/ibutsuContext';

export const useWidgets = ({
  dashboardId = null,
  editCallback = () => {},
  deleteCallback = () => {},
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
        data.widgets.forEach((widget) => {
          widget.params['project'] = primaryObject.id;
        });
        setWidgets(data.widgets);
      } catch (error) {
        console.error(error);
      }
    };

    if (dashboardId) {
      const debouncer = setTimeout(() => {
        getWidgets();
      }, 100);
      return () => {
        clearTimeout(debouncer);
      };
    }
  }, [dashboardId, primaryObject]);

  const widgetComponents = useMemo(() => {
    return widgets?.map((widget) => {
      if (KNOWN_WIDGETS.includes(widget.widget)) {
        return (
          <GridItem xl={4} lg={6} md={12} key={widget.id}>
            {widget.type === 'widget' &&
              widget.widget === 'jenkins-heatmap' && (
                <FilterHeatmapWidget
                  title={widget.title}
                  params={widget.params}
                  includeAnalysisLink={true}
                  type="jenkins"
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
                includeAnalysisLink={true}
                onDeleteClick={() => {
                  deleteCallback(widget.id);
                }}
                onEditClick={() => {
                  editCallback(widget.id);
                }}
              />
            )}
            {widget.type === 'widget' && widget.widget === 'run-aggregator' && (
              <GenericBarWidget
                title={widget.title}
                params={widget.params}
                horizontal={true}
                percentData={true}
                barWidth={20}
                onDeleteClick={() => {
                  deleteCallback(widget.id);
                }}
                onEditClick={() => {
                  editCallback(widget.id);
                }}
              />
            )}
            {widget.type === 'widget' && widget.widget === 'result-summary' && (
              <ResultSummaryWidget
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
            {widget.type === 'widget' &&
              widget.widget === 'result-aggregator' && (
                <ResultAggregatorWidget
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
  }, [deleteCallback, editCallback, widgets]);

  return { widgets, widgetComponents };
};
