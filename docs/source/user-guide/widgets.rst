.. _user-guide/widgets:

Dashboards and widgets
======================

Ibutsu **dashboards** are collections of **widgets**: charts and summaries built from your runs and
test results. Use them to monitor pass rates, compare components or environments, and track Jenkins
jobs over time.

Before you start
----------------

* Select the **project** you care about from the project dropdown in the header. Widgets use this
  as their default scope when you save them.
* Open **Dashboard** in the left navigation.
* Pick a dashboard from **Select a dashboard**, or click **New Dashboard** to create one. Widgets
  are shown only after a dashboard is selected.

Adding, editing, and removing widgets
-------------------------------------

#. With a project and dashboard selected, click **Add Widget**.
#. In the wizard, choose a **widget type**, set a **title**, and fill in the parameters for that
   type (for example Jenkins job name, number of builds, or grouping field).
#. Save. The widget appears on the grid; use the actions on the widget card to **edit** or
   **delete** it later.

Many widgets accept **additional filters** as a comma-separated list (same syntax as in the tables
and in reports). See :ref:`user-guide/filter-help` for operators and examples.

Built-in widget types
---------------------

These types are available from the **Add Widget** flow (names match the UI labels where possible):

.. list-table::
   :header-rows: 1
   :widths: 28 72

   * - Widget
     - What it shows
   * - **Jenkins Pipeline Heatmap** (``jenkins-heatmap``)
     - Pass/fail patterns across recent Jenkins builds for a job, grouped by a result field (often
       ``component``). Uses ``metadata.jenkins.job_name`` for the job.
   * - **Filtered Heatmap** (``filter-heatmap``)
     - Like a pipeline heatmap, but driven entirely by **additional filters** you supply (no fixed
       Jenkins job parameter in the same way).
   * - **Run Aggregation** (``run-aggregator``)
     - Aggregates recent **runs** over a time window (weeks), grouped by a run field such as
       ``component`` or ``env``.
   * - **Result Summary** (``result-summary``)
     - High-level counts for **results**, optionally narrowed by ``source``, ``env``, Jenkins job,
       or extra filters.
   * - **Result Aggregation** (``result-aggregator``)
     - Counts **results** grouped by a field (for example ``result``, ``env``, or metadata keys
       such as ``metadata.assignee``), over a number of days or a specific ``run_id``.
   * - **Jenkins Bar Chart** (``jenkins-bar-chart``)
     - Bar chart of aggregate results for one Jenkins job across recent builds.
   * - **Jenkins Line Chart** (``jenkins-line-chart``)
     - Line chart of Jenkins job run duration (or related timing) across recent builds.
   * - **Importance by component** (``importance-component``)
     - Breakdown by component and importance for a Jenkins job (and optional environment /
       component filters).

Parameters and validation rules for each type are defined on the server; if the wizard rejects a
value, check required fields (for example ``job_name`` on Jenkins-oriented widgets) and filter
syntax.

See also
--------

* :ref:`user-guide/filter-help` — filter operators and ``additional_filters`` examples.
* :ref:`user-guide/getting-started` — sending results so dashboards have data to show.
