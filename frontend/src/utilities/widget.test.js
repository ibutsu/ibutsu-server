import {
  RESULT_BASED_WIDGETS,
  RUN_BASED_WIDGETS,
  CHART_WIDGETS,
  HEATMAP_WIDGETS,
  ANALYSIS_WIDGETS,
  WIDGET_CATEGORIES,
  isResultBasedWidget,
  isRunBasedWidget,
  hasFilterSupport,
  filterNonFilterParams,
  getFieldOptionsForWidget,
  isChartWidget,
  isHeatmapWidget,
  isAnalysisWidget,
  getWidgetCategory,
  groupWidgetsByCategory,
  getWidgetsByCategory,
} from './widget';

describe('Widget Utilities', () => {
  describe('Widget Classifications', () => {
    it('should export RESULT_BASED_WIDGETS', () => {
      expect(RESULT_BASED_WIDGETS).toContain('result-summary');
      expect(RESULT_BASED_WIDGETS).toContain('result-aggregator');
      expect(RESULT_BASED_WIDGETS).toContain('importance-component');
    });

    it('should export RUN_BASED_WIDGETS', () => {
      expect(RUN_BASED_WIDGETS).toContain('run-aggregator');
      expect(RUN_BASED_WIDGETS).toContain('jenkins-heatmap');
      expect(RUN_BASED_WIDGETS).toContain('filter-heatmap');
    });

    it('should export CHART_WIDGETS', () => {
      expect(CHART_WIDGETS).toContain('jenkins-bar-chart');
      expect(CHART_WIDGETS).toContain('jenkins-line-chart');
      expect(CHART_WIDGETS).toContain('result-summary');
    });

    it('should export HEATMAP_WIDGETS', () => {
      expect(HEATMAP_WIDGETS).toContain('jenkins-heatmap');
      expect(HEATMAP_WIDGETS).toContain('filter-heatmap');
    });

    it('should export ANALYSIS_WIDGETS', () => {
      expect(ANALYSIS_WIDGETS).toContain('importance-component');
    });
  });

  describe('isResultBasedWidget', () => {
    it('should return true for result-based widgets', () => {
      expect(isResultBasedWidget('result-summary')).toBe(true);
      expect(isResultBasedWidget('result-aggregator')).toBe(true);
      expect(isResultBasedWidget('importance-component')).toBe(true);
    });

    it('should return false for run-based widgets', () => {
      expect(isResultBasedWidget('run-aggregator')).toBe(false);
      expect(isResultBasedWidget('jenkins-heatmap')).toBe(false);
    });

    it('should return false for unknown widgets', () => {
      expect(isResultBasedWidget('unknown-widget')).toBe(false);
      expect(isResultBasedWidget('')).toBe(false);
      expect(isResultBasedWidget(null)).toBe(false);
      expect(isResultBasedWidget(undefined)).toBe(false);
    });
  });

  describe('isRunBasedWidget', () => {
    it('should return true for run-based widgets', () => {
      expect(isRunBasedWidget('run-aggregator')).toBe(true);
      expect(isRunBasedWidget('jenkins-heatmap')).toBe(true);
      expect(isRunBasedWidget('filter-heatmap')).toBe(true);
    });

    it('should return false for result-based widgets', () => {
      expect(isRunBasedWidget('result-summary')).toBe(false);
      expect(isRunBasedWidget('importance-component')).toBe(false);
    });

    it('should return false for unknown widgets', () => {
      expect(isRunBasedWidget('unknown-widget')).toBe(false);
      expect(isRunBasedWidget('')).toBe(false);
      expect(isRunBasedWidget(null)).toBe(false);
    });
  });

  describe('hasFilterSupport', () => {
    it('should return true when widget has additional_filters param', () => {
      const widgetType = {
        params: [
          { name: 'project' },
          { name: 'additional_filters' },
          { name: 'weeks' },
        ],
      };
      expect(hasFilterSupport(widgetType)).toBe(true);
    });

    it('should return false when widget has no additional_filters param', () => {
      const widgetType = {
        params: [{ name: 'project' }, { name: 'weeks' }],
      };
      expect(hasFilterSupport(widgetType)).toBe(false);
    });

    it('should return false when widget has empty params', () => {
      const widgetType = { params: [] };
      expect(hasFilterSupport(widgetType)).toBe(false);
    });

    it('should return false when widget has no params property', () => {
      const widgetType = {};
      expect(hasFilterSupport(widgetType)).toBeFalsy();
    });

    it('should return false for null/undefined widget type', () => {
      expect(hasFilterSupport(null)).toBeFalsy();
      expect(hasFilterSupport(undefined)).toBeFalsy();
    });
  });

  describe('filterNonFilterParams', () => {
    it('should filter out additional_filters and project params', () => {
      const params = [
        { name: 'project' },
        { name: 'additional_filters' },
        { name: 'weeks' },
        { name: 'component' },
      ];
      const filtered = filterNonFilterParams(params);
      expect(filtered).toHaveLength(2);
      expect(filtered).toContainEqual({ name: 'weeks' });
      expect(filtered).toContainEqual({ name: 'component' });
    });

    it('should return empty array when all params are filtered', () => {
      const params = [{ name: 'project' }, { name: 'additional_filters' }];
      const filtered = filterNonFilterParams(params);
      expect(filtered).toEqual([]);
    });

    it('should return all params when none are filter params', () => {
      const params = [{ name: 'weeks' }, { name: 'component' }];
      const filtered = filterNonFilterParams(params);
      expect(filtered).toEqual(params);
    });

    it('should handle empty params array', () => {
      expect(filterNonFilterParams([])).toEqual([]);
    });

    it('should handle null/undefined params', () => {
      expect(filterNonFilterParams(null)).toEqual([]);
      expect(filterNonFilterParams(undefined)).toEqual([]);
    });
  });

  describe('getFieldOptionsForWidget', () => {
    const RESULT_FIELDS = ['result_field_1', 'result_field_2'];
    const RUN_FIELDS = ['run_field_1', 'run_field_2'];

    it('should return RESULT_FIELDS for result-based widgets', () => {
      expect(
        getFieldOptionsForWidget('result-summary', RESULT_FIELDS, RUN_FIELDS),
      ).toEqual(RESULT_FIELDS);
      expect(
        getFieldOptionsForWidget(
          'importance-component',
          RESULT_FIELDS,
          RUN_FIELDS,
        ),
      ).toEqual(RESULT_FIELDS);
    });

    it('should return RUN_FIELDS for run-based widgets', () => {
      expect(
        getFieldOptionsForWidget('run-aggregator', RESULT_FIELDS, RUN_FIELDS),
      ).toEqual(RUN_FIELDS);
      expect(
        getFieldOptionsForWidget('jenkins-heatmap', RESULT_FIELDS, RUN_FIELDS),
      ).toEqual(RUN_FIELDS);
    });

    it('should return RUN_FIELDS for unknown widgets', () => {
      expect(
        getFieldOptionsForWidget('unknown-widget', RESULT_FIELDS, RUN_FIELDS),
      ).toEqual(RUN_FIELDS);
    });
  });

  describe('isChartWidget', () => {
    it('should return true for chart widgets', () => {
      expect(isChartWidget('jenkins-bar-chart')).toBe(true);
      expect(isChartWidget('jenkins-line-chart')).toBe(true);
      expect(isChartWidget('result-summary')).toBe(true);
      expect(isChartWidget('result-aggregator')).toBe(true);
      expect(isChartWidget('run-aggregator')).toBe(true);
    });

    it('should return false for non-chart widgets', () => {
      expect(isChartWidget('jenkins-heatmap')).toBe(false);
      expect(isChartWidget('importance-component')).toBe(false);
    });

    it('should return false for unknown widgets', () => {
      expect(isChartWidget('unknown-widget')).toBe(false);
    });
  });

  describe('isHeatmapWidget', () => {
    it('should return true for heatmap widgets', () => {
      expect(isHeatmapWidget('jenkins-heatmap')).toBe(true);
      expect(isHeatmapWidget('filter-heatmap')).toBe(true);
    });

    it('should return false for non-heatmap widgets', () => {
      expect(isHeatmapWidget('result-summary')).toBe(false);
      expect(isHeatmapWidget('run-aggregator')).toBe(false);
    });

    it('should return false for unknown widgets', () => {
      expect(isHeatmapWidget('unknown-widget')).toBe(false);
    });
  });

  describe('isAnalysisWidget', () => {
    it('should return true for analysis widgets', () => {
      expect(isAnalysisWidget('importance-component')).toBe(true);
    });

    it('should return false for non-analysis widgets', () => {
      expect(isAnalysisWidget('result-summary')).toBe(false);
      expect(isAnalysisWidget('jenkins-heatmap')).toBe(false);
    });

    it('should return false for unknown widgets', () => {
      expect(isAnalysisWidget('unknown-widget')).toBe(false);
    });
  });

  describe('getWidgetCategory', () => {
    it('should return correct category for chart widgets', () => {
      expect(getWidgetCategory('jenkins-bar-chart')).toBe(
        WIDGET_CATEGORIES.CHARTS,
      );
      expect(getWidgetCategory('result-summary')).toBe(
        WIDGET_CATEGORIES.CHARTS,
      );
    });

    it('should return correct category for heatmap widgets', () => {
      expect(getWidgetCategory('jenkins-heatmap')).toBe(
        WIDGET_CATEGORIES.HEATMAPS,
      );
      expect(getWidgetCategory('filter-heatmap')).toBe(
        WIDGET_CATEGORIES.HEATMAPS,
      );
    });

    it('should return correct category for analysis widgets', () => {
      expect(getWidgetCategory('importance-component')).toBe(
        WIDGET_CATEGORIES.ANALYSIS,
      );
    });

    it('should return correct category for aggregation widgets', () => {
      expect(getWidgetCategory('result-aggregator')).toBe(
        WIDGET_CATEGORIES.AGGREGATION,
      );
      expect(getWidgetCategory('run-aggregator')).toBe(
        WIDGET_CATEGORIES.AGGREGATION,
      );
    });

    it('should return "Other" for unknown widgets', () => {
      expect(getWidgetCategory('unknown-widget')).toBe('Other');
      expect(getWidgetCategory('')).toBe('Other');
      expect(getWidgetCategory(null)).toBe('Other');
    });
  });

  describe('groupWidgetsByCategory', () => {
    it('should group widgets by category', () => {
      const widgets = [
        { id: 'result-summary' },
        { id: 'jenkins-heatmap' },
        { id: 'jenkins-bar-chart' },
        { id: 'importance-component' },
        { id: 'run-aggregator' },
      ];

      const grouped = groupWidgetsByCategory(widgets);

      expect(grouped[WIDGET_CATEGORIES.CHARTS]).toHaveLength(2);
      expect(grouped[WIDGET_CATEGORIES.HEATMAPS]).toHaveLength(1);
      expect(grouped[WIDGET_CATEGORIES.ANALYSIS]).toHaveLength(1);
      expect(grouped[WIDGET_CATEGORIES.AGGREGATION]).toHaveLength(1);
    });

    it('should handle widgets with widget property instead of id', () => {
      const widgets = [
        { widget: 'result-summary' },
        { widget: 'jenkins-heatmap' },
      ];

      const grouped = groupWidgetsByCategory(widgets);

      expect(grouped[WIDGET_CATEGORIES.CHARTS]).toHaveLength(1);
      expect(grouped[WIDGET_CATEGORIES.HEATMAPS]).toHaveLength(1);
    });

    it('should handle empty widgets array', () => {
      const grouped = groupWidgetsByCategory([]);
      expect(grouped).toEqual({});
    });

    it('should handle widgets with unknown categories', () => {
      const widgets = [{ id: 'unknown-widget' }];

      const grouped = groupWidgetsByCategory(widgets);

      expect(grouped.Other).toHaveLength(1);
      expect(grouped.Other[0]).toEqual({ id: 'unknown-widget' });
    });

    it('should handle mixed known and unknown widgets', () => {
      const widgets = [
        { id: 'result-summary' },
        { id: 'unknown-widget-1' },
        { id: 'jenkins-heatmap' },
        { id: 'unknown-widget-2' },
      ];

      const grouped = groupWidgetsByCategory(widgets);

      expect(grouped[WIDGET_CATEGORIES.CHARTS]).toHaveLength(1);
      expect(grouped[WIDGET_CATEGORIES.HEATMAPS]).toHaveLength(1);
      expect(grouped.Other).toHaveLength(2);
    });
  });

  describe('getWidgetsByCategory', () => {
    const widgets = [
      { id: 'result-summary' },
      { id: 'jenkins-heatmap' },
      { id: 'jenkins-bar-chart' },
      { id: 'importance-component' },
      { id: 'run-aggregator' },
      { id: 'result-aggregator' },
    ];

    it('should filter widgets by CHARTS category', () => {
      const filtered = getWidgetsByCategory(widgets, WIDGET_CATEGORIES.CHARTS);
      // result-summary and jenkins-bar-chart are in CHARTS category
      expect(filtered).toHaveLength(2);
      expect(filtered.map((w) => w.id)).toContain('result-summary');
      expect(filtered.map((w) => w.id)).toContain('jenkins-bar-chart');
    });

    it('should filter widgets by HEATMAPS category', () => {
      const filtered = getWidgetsByCategory(
        widgets,
        WIDGET_CATEGORIES.HEATMAPS,
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('jenkins-heatmap');
    });

    it('should filter widgets by ANALYSIS category', () => {
      const filtered = getWidgetsByCategory(
        widgets,
        WIDGET_CATEGORIES.ANALYSIS,
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('importance-component');
    });

    it('should filter widgets by AGGREGATION category', () => {
      const filtered = getWidgetsByCategory(
        widgets,
        WIDGET_CATEGORIES.AGGREGATION,
      );
      expect(filtered).toHaveLength(2);
      expect(filtered.map((w) => w.id)).toContain('run-aggregator');
      expect(filtered.map((w) => w.id)).toContain('result-aggregator');
    });

    it('should return empty array for unknown category', () => {
      const filtered = getWidgetsByCategory(widgets, 'NonExistent');
      expect(filtered).toEqual([]);
    });

    it('should handle widgets with widget property instead of id', () => {
      const widgetsWithWidget = [
        { widget: 'result-summary' },
        { widget: 'jenkins-heatmap' },
      ];

      const filtered = getWidgetsByCategory(
        widgetsWithWidget,
        WIDGET_CATEGORIES.CHARTS,
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].widget).toBe('result-summary');
    });

    it('should handle empty widgets array', () => {
      const filtered = getWidgetsByCategory([], WIDGET_CATEGORIES.CHARTS);
      expect(filtered).toEqual([]);
    });
  });
});
