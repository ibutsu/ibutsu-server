.. _user-guide/filter-help:

Filter Help
===========

Filtering test results in Ibutsu's frontend is designed expose SQLAlchemy's filtering operations to
the user. For all filters, the following translation is used:

.. list-table:: Ibutsu Filters
   :header-rows: 1

   * - Operator
     - String Name
     - SQLAlchemy Example
     - Description
   * - =
     - eq
     - ``Result.<column> == <value>``
     - Equals
   * - !
     - ne
     - ``Result.<column> != <value>``
     - Does not equal
   * - >
     - gt
     - ``Result.<column> > <value>``
     - Greater than
   * - <
     - lt
     - ``Result.<column> < <value>``
     - Less than
   * - )
     - gte
     - ``Result.<column> >= <value>``
     - Greater than or equal to
   * - (
     - lte
     - ``Result.<column> <= <value>``
     - Less than or eqaul to
   * - ``*``
     - in
     - ``Result.<column>.in_(<values>)``
     - Column ``in`` list of potential values
   * - ~
     - regex
     - ``Result.<column>.op("~")(<value>)``
     - Regex match that ``column`` contains ``value``
   * - @
     - exists
     - ``Result.<column> != None`` or ``Result.<column> == None``
     - Column exists and is defined

The information for this table is taken from `filters.py`_.

Filtering the results/runs tables
---------------------------------
Filtering the results and runs tables is done via select dropdowns that correspond to:

* column (also called ``field`` in the UI)
* operator (shown with the 'string name' in UI)
* value

Where column is a column on the ``Run`` or ``Result`` table, operator is one of the string names in
the table above, and value is the desired value by which you'd like to filter.

The select dropdowns give several options for ``column``, but it is possible to enter your own column
if it is not shown. Just type any desired column.

*Note*: The available columns are shown in the DB models for `Runs/Results`_.
In the BE and FE, ``metadata`` is translated to the ``data`` column in the DB.

It is also possible to auto-apply a filter by clicking the blue pill labels that appear in the Run/Results
table. These will automatically filter results/runs by ``component`` or ``env``.

Comma-separated list of filters
-------------------------------
There are two places in the UI where a user is able to enter a comma-separated list of filters:

* the ``additional_filters`` parameter when creating a new widget
* the ``Filter`` field when building a report

These are simple text input components that take a string of comma-separated filters. Here, a user
is meant to use the ``operator`` in the table above to filter on the appropriate column. Some examples
of these filters include:

* ``metadata.tags=platform-experience,source=local,summary.passes>10``
* ``metadata.assignee=jdoe,metadata.exception_name=AssertionError,result=failed``

.. _filters.py: https://github.com/ibutsu/ibutsu-server/blob/main/backend/ibutsu_server/filters.py
.. _Runs/Results: https://github.com/ibutsu/ibutsu-server/blob/main/backend/ibutsu_server/db/models.py
