/**
 * Widget utility functions for classification and parameter handling
 */

// Widget type classifications
export const RESULT_BASED_WIDGETS = [
  'result-summary',
  'result-aggregator',
  'importance-component',
];

export const RUN_BASED_WIDGETS = [
  'run-aggregator',
  'jenkins-heatmap',
  'filter-heatmap',
  'jenkins-bar-chart',
  'jenkins-line-chart',
];

// Additional widget classifications
export const CHART_WIDGETS = [
  'jenkins-bar-chart',
  'jenkins-line-chart',
  'result-summary',
  'result-aggregator',
  'run-aggregator',
];

export const HEATMAP_WIDGETS = ['jenkins-heatmap', 'filter-heatmap'];

export const ANALYSIS_WIDGETS = ['importance-component'];

// Widget categories for UI grouping
export const WIDGET_CATEGORIES = {
  CHARTS: 'Charts',
  HEATMAPS: 'Heatmaps',
  ANALYSIS: 'Analysis',
  AGGREGATION: 'Aggregation',
};

export const WIDGET_CATEGORY_MAP = {
  'jenkins-bar-chart': WIDGET_CATEGORIES.CHARTS,
  'jenkins-line-chart': WIDGET_CATEGORIES.CHARTS,
  'result-summary': WIDGET_CATEGORIES.CHARTS,
  'jenkins-heatmap': WIDGET_CATEGORIES.HEATMAPS,
  'filter-heatmap': WIDGET_CATEGORIES.HEATMAPS,
  'importance-component': WIDGET_CATEGORIES.ANALYSIS,
  'result-aggregator': WIDGET_CATEGORIES.AGGREGATION,
  'run-aggregator': WIDGET_CATEGORIES.AGGREGATION,
};

/**
 * Check if a widget type is result-based (uses result data)
 */
export const isResultBasedWidget = (widgetId) => {
  return RESULT_BASED_WIDGETS.includes(widgetId);
};

/**
 * Check if a widget type is run-based (uses run data)
 */
export const isRunBasedWidget = (widgetId) => {
  return RUN_BASED_WIDGETS.includes(widgetId);
};

/**
 * Check if a widget type supports filters
 */
export const hasFilterSupport = (widgetType) => {
  return widgetType?.params?.some(
    (param) => param.name === 'additional_filters',
  );
};

/**
 * Filter out filter parameters and project parameter from widget parameters
 * (filters and project are handled separately in the UI)
 */
export const filterNonFilterParams = (params) => {
  return (
    params?.filter(
      (param) =>
        param.name !== 'additional_filters' && param.name !== 'project',
    ) || []
  );
};

/**
 * Get the appropriate field options for a widget type
 * Returns a function that can be called with the field constants
 */
export const getFieldOptionsForWidget = (
  widgetId,
  RESULT_FIELDS,
  RUN_FIELDS,
) => {
  return isResultBasedWidget(widgetId) ? RESULT_FIELDS : RUN_FIELDS;
};

/**
 * Check if a widget is a chart type
 */
export const isChartWidget = (widgetId) => {
  return CHART_WIDGETS.includes(widgetId);
};

/**
 * Check if a widget is a heatmap type
 */
export const isHeatmapWidget = (widgetId) => {
  return HEATMAP_WIDGETS.includes(widgetId);
};

/**
 * Check if a widget is an analysis type
 */
export const isAnalysisWidget = (widgetId) => {
  return ANALYSIS_WIDGETS.includes(widgetId);
};

/**
 * Get the category for a widget type
 */
export const getWidgetCategory = (widgetId) => {
  return WIDGET_CATEGORY_MAP[widgetId] || 'Other';
};

/**
 * Group widgets by category
 */
export const groupWidgetsByCategory = (widgets) => {
  const grouped = {};

  widgets.forEach((widget) => {
    const category = getWidgetCategory(widget.id || widget.widget);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(widget);
  });

  return grouped;
};

/**
 * Get widgets by category
 */
export const getWidgetsByCategory = (widgets, category) => {
  return widgets.filter(
    (widget) => getWidgetCategory(widget.id || widget.widget) === category,
  );
};
