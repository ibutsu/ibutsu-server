Version 1.13.2
==============

* Fix division by 0 in the jenkins heatmap
* Change 204 to 206
* Add an API endpoint to check the status of a task
* Small changes to OCP templates
* Update pre-commit; add in task for syncing aborted runs
* Update the Python dependencies (#169)

Version 1.13.1
==============

* Pin SqlAlchemy to 1.3.23 (#158)

Version 1.13.0
==============

* Fix bugs in the OpenAPI specification, and make sure to drop the 'data' attribute before sending it out (#153)
* Use 'id' rather than 'name'
* Use 'in' rather than dict.get()
* updated importer to work with older style junit xml
* Use the number of collected tests
* Add a note on how to generate the changelog (#148)
* Actually count when we are filtering on very small subset of rows
* oc create -f will just create the template, we need to process it
* Add cronjob/job for nightly vacuuming of database

Version 1.12.2
==============

* Add ocp templates for backup cronjob
* Add in tasks to prune old runs and results from the DB
* Also index requirements
* Fix filters on reports
* Add a upgrade function to add gin indexes on metadata.tags
* Added EmptyObject component for missing results/runs (#133)
* Validate UUID in OpenAPI spec and controllers
* Just use "ls" rather than "ls -ltr"

Version 1.12.1
==============

* Release 1.12.1
* Remember tab + updates (#115)
* Update API spec to allow null values in Runs (#118)
* Pass project along with file when importing via the UI (closes #110) (#116)
* Remove reference to MongoDB in docs
* Add a button for deleting a single widget from a dashboard
* Add some documentation about filters, fixup docs elsewhere
* Add a button to delete dashboards
* Add some default fields and specify whether it's required
* Add custom filters for some widgets
* Bring the CHANGELOG up to date (#103)
* Add a new option to the release script to update the changelog (#102)

Version 1.12.0
==============

* Create a UI to add dashboards and widgets (#100)
* Build the custom dashboards (#99)
* Build the dashboard API (#96)
* Create a way to upgrade databases on the fly (#95)

Version 1.11.4
==============

* Frontend updates to show the annotation in the heatmap
* Add endpoint to update multiple runs at a time
* Fix result tree page crash on junit imported run
* Add xfail/xpass to widget calculations
* Fix loading of result component
* Add `summary.tests` to the `numeric_fields`
* Allow filtering by JSON run summary fields
* Sort recent builds by `start_time` rather than `build_number` (#84)
* Fix bugs #78 and #79 (#83)

Version 1.11.3
==============

* Fix bugs #78 and #79 (#83)
* Fix issue #75 (#80)
* Fix task tests (#80)
* Updates to support xfail in Ibutsu
* Update file pruning for PSQL

Version 1.11.2
==============

* Fix an additional bug with the project selector

Version 1.11.1
==============

A new bug fix release in the 1.11.x series, this fixes the following bugs:

* Screenshots not showing up on the results page
* Project selector causes a blank screen when trying to change project
* Widget grouping by `metadata.component` instead of `component`

Version 1.11.0
==============

In order to overcome some performance and other issues, and due to MongoDB's license changes,
Ibutsu has now migrated to use PostgreSQL.

Version 1.10.2
==============

* Fix a small celery error `Cannot mix new and old setting keys`

Version 1.10.1
==============

* Fix styling of count skips on Jenkins Job Analysis page (#29)
* [Heatmap] Sort builds by `start_time`, not the string `build_number`
* [Heatmap] Use an aggregation to get the correct number of jobs that exist in the DB
* [Heatmap] Don't show columns in which all the plugins failed
* Add link to JIRA issues.redhat.com
* Convert failure classification table into its own component
* Expose the `count_skips` parameter in the UI (#24)
* Check to make sure `start_time` exists

Version 1.10.0
==============

* Add a switch to change from overall health from bar to area chart
* Show active filters and make exception name clickable in failure classification table
* Apply a limit to the amount of runs from which we create the JJV
* Make failure classification table expandable, to aid in debugging
* Add a tooltip to the generic area chart
* Fix warnings for links, limit reports to 1e5 documents
* Make links open in a new tab
* Add link to submit upstream issue, make links open in new tab
* Limit documents returned by reports to a reasonable number
* Add trademark and file retention policy to About modal
* Add a link to the docs on the about modal
* Limit the number of results we can display in the results table.
* Made run-list component and env pills clickable for filtering
* Update the rtd conf file location
* Fix the `master_doc` for Sphinx
* Make the docs requirements file match the config file
* Add readthedocs config
* Change Travis config to support both Python and JS
* Initial import from Gitlab

Version 1.9.0
=============

* Allow for displaying 70, 150 builds in the Overall Health and Build Duration
* Show tags if they are available in the metadata
* Add filters to the Jenkins Job page
* Use Linkify to create a link for the `skip_reason`
* Add a link to the jenkins build url on the Jenkins Job page

Version 1.8.1
=============

* Update the logo and background in the About modal
* Add in a task to delete files > 256 KiB
* Don't retry pruning task
* Tweak the UI to make things look better
* Change pruning to remove files older than 3 months
* Update to run only once, not every minute
* Add the line chart BE endpoint and FE widget

Version 1.8.0
=============

* Upgrade to the latest version of PatternFly4
* small fix so this text doesn't display when the widget is loading
* Some small fixes, add link to analysis page on dashboard
* Add a widget endpoint and FE View component for a Jenkins Analysis View
* Add in a chgrp and chmod for the image
* Fix Dockerfile for the celery beat scheduler
* Add artifact pruning as a periodic task
* Add in 'Dependency Outage' as a classification
* Add in a task to delete old artifact files
* Add 'Unknown' to classification dropdown
* Fix KeyError on prod
* Fix for non-null fields in Jenkins Job View

Version 1.7.4
=============

* "Classify failures" tab added to the Run page, allows for classification of multiple test failures at a time
* Added Jenkins Job BE endpoint for aggregating results of any Jenkins Job
* Tables refactored into a common `FilterTable` component
* Enabled classification dropdown for skipped results
* More visible description for `ParamDropdown` on widgets
* Added in dropdown for settings the number of builds in Vortex Heatmap
* Added in support for custom page components, added a Jenkins Job View

Version 1.7.3
=============

* Add a generic dropdown for changing widget params in the FE
* Add in a common component widgets can use as a header that includes a refresh
* Add KVP for source on run detail page
* Sort alphabetically in run aggregator widget
* Fix rounding in run aggregator
* Fix the URL for frontend version checking
* Fix the filters on the run page not being read from the URL
* Fix the ordering in `update_run` to use the new `start_time` column
* Improve the execution time of `_get_recent_run_data`

Version 1.7.2
=============

* Make failure classification available on error results as well as failed results
* Update all references of `starttime` to `start_time`
* Add a task for adding metadata.project to runs/results
* Create a task to add `start_time` to all results
* Expand the tree to the level of the python files by default
* Change heatmap links to go to the run page
* Use .get to avoid KeyError
* Add exception handling for older run IDs
* Add the DB task to celery
* Add a task to recreate runs from results
* Update the OpenAPI spec to follow what we're doing
* Add in some documentation about importing results
* Fixup the junit xml importer
* Adding a doc-requirements file for packages required to build the docs
* Use componentDidUpdate rather than the eventEmitter for widgets
* Make a start on the documentation
* Add the category dropdown for skips
* Add in the result-aggregator widget endpoint
* Fix for percentage colouring in results tree on run page

Version 1.7.1
=============

* Fix tree nodes that were incorrect when test params contain paths
* Fix a bug where the test result pane was not updated after clicking a new node
* Hide the search bar until it actually works
* Add a spinner when the tree is loading
* Start with a fresh tree when the tab is loaded again
* Write some tests around some of the above functions

Version 1.7.0
=============

* Expand the results tree page in the run view
* Add in a result aggregator endpoint (for future widget)
* Add project to widget queries
* UI tweaks

Version 1.6.0
=============

* Add a skip reason to the result details page
* Rearrange run summary page to allow for more details/metadata to be displayed in the future
* Move test tree and results into tabs on run details page
* Add project selector drop
* Implement support for project selector dropdown (i.e. automatic filtering based on project selected)

Version 1.5.1
=============

* Remove API for static widgets
* Add project lookups in all the relevant places
* Add in loading and dynamic chart height
* Fix the parameter error in the widgets

Version 1.5.0
=============

* Create new widget framework
* Create new Jenkins heatmap widget
* Create new result summary widget
* Create new run aggregator widget
* Remove the old static widgets from the dashboard
* Fix some issues with the FileUpload component
* Write some tests for the FileUpload component
* Write some other JavaScript tests
* Add filter by source on run list page
* Fix a small filtering bug

Version 1.4.4
=============

* Support partial archives in the importer.
* Support updated archives
* Fix a couple issues in displaying dates
* Add getOperationMode, add handling of 'exists' operator
* Make UI filter operations depend on the field that is selected

Version 1.4.3
=============

* Support multi select from dropdown menus when using "in" operation
* Add in `MultiValueInput` widget for "in" operation on results and run pages
* Add error handling to all tables
* Add empty states to all tables
* Add spinners to all tables
* Update the Docker setup
* Add in unix timestamp `start_time` to the run object
* Add filters to the run page
