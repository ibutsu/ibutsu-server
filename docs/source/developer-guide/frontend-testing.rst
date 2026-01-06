Frontend Testing Guide
======================

This comprehensive guide covers testing practices, patterns, and best practices for the ibutsu-server frontend. Tests use React Testing Library with Jest to render real components with providers, ensuring they validate actual user-facing behavior.

.. contents:: Table of Contents
   :local:
   :depth: 2

Philosophy
----------

Integration Testing Approach
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Our testing philosophy prioritizes **integration tests over heavy mocking** because:

* **Reliability**: Real component rendering catches actual issues
* **Maintainability**: Less mock code means less to maintain
* **Confidence**: Tests validate real user-facing behavior
* **Simplicity**: Easier to understand and write

When to Mock vs When to Render Real Components
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Render Real Components For:**

* React component rendering with providers
* User interactions (clicks, typing, form submissions)
* State management within components
* PatternFly component integration
* Context provider behavior

**Mock Only External Services:**

* ``HttpClient`` (API calls)
* ``Settings.serverUrl``
* ``localStorage`` / ``sessionStorage``
* External OAuth providers (Google, Facebook, etc.)
* Heavy child components that are tested separately

Running Tests
-------------

Commands
~~~~~~~~

.. code-block:: bash

   # Run all tests
   cd frontend
   yarn test

   # Run with coverage report
   yarn test:coverage

   # Run in watch mode for development
   yarn test -- --watch

   # Run specific test file
   yarn test -- src/pages/run.test.js

   # Run tests matching a pattern
   yarn test -- --testNamePattern="should fetch"

   # Run with verbose output
   yarn test -- --verbose

Coverage Reports
~~~~~~~~~~~~~~~~

.. code-block:: bash

   # Generate coverage report
   yarn test:coverage

   # Coverage reports are generated in:
   # - frontend/coverage/lcov-report/index.html (HTML report)
   # - frontend/coverage/coverage-summary.json (JSON summary)

Coverage Requirements
~~~~~~~~~~~~~~~~~~~~~

* **Target**: 90% line coverage per module
* **Global target**: 65% overall line coverage
* All new tests must follow integration testing patterns

Test File Organization
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: text

   frontend/src/
   ├── test-utils/
   │   ├── constants.js      # Test UUIDs, timestamps, metadata
   │   ├── mock-data.js      # Factory functions for test data
   │   ├── test-helpers.js   # Render helpers, mock utilities
   │   └── index.js          # Re-exports all utilities
   ├── components/
   │   ├── example.js
   │   └── example.test.js   # Co-located test file
   ├── pages/
   │   ├── example.js
   │   └── example.test.js
   └── setupTests.js         # Global test setup

Test Utilities
--------------

Mock Data Factories
~~~~~~~~~~~~~~~~~~~

The ``src/test-utils/mock-data.js`` module provides factory functions for creating test data:

.. code-block:: javascript

   import {
     createMockProject,
     createMockRun,
     createMockResult,
     createMockJenkinsRun,
     createMockRunWithoutJenkins,
     createMockResultsResponse,
   } from '../test-utils';

   // Create a basic project
   const project = createMockProject();

   // Create a run with custom properties
   const run = createMockRun({
     summary: { failures: 5, errors: 2, tests: 100 },
   });

   // Create a run with Jenkins metadata
   const jenkinsRun = createMockJenkinsRun();

   // Create a run without Jenkins metadata
   const simpleRun = createMockRunWithoutJenkins();

   // Create paginated response
   const response = createMockResultsResponse([result1, result2]);

Test Constants
~~~~~~~~~~~~~~

The ``src/test-utils/constants.js`` module provides consistent test values:

.. code-block:: javascript

   import {
     TEST_UUIDS,
     TEST_TIMESTAMPS,
     TEST_RESULTS,
     TEST_JENKINS_METADATA,
     TEST_NESTED_METADATA,
   } from '../test-utils';

   // Use consistent UUIDs
   const projectId = TEST_UUIDS.PROJECT_1;
   const runId = TEST_UUIDS.RUN_1;

   // Use Jenkins metadata patterns
   const jenkinsData = TEST_JENKINS_METADATA.BASIC;

Test Helpers
~~~~~~~~~~~~

The ``src/test-utils/test-helpers.js`` module provides render utilities:

.. code-block:: javascript

   import {
     renderWithRouter,
     renderWithIbutsuContext,
     renderWithAllProviders,
     createMockResponse,
     createMockErrorResponse,
     mockHttpClientResponses,
   } from '../test-utils';

   // Render with router only
   renderWithRouter(<Component />, { initialRoute: '/runs' });

   // Render with all providers
   renderWithAllProviders(<Component />, {
     initialRoute: '/project/123/runs',
     ibutsuContext: { primaryObject: mockProject },
     filterContext: { activeFilters: [] },
   });

   // Mock multiple HTTP responses
   mockHttpClientResponses({
     '/run/': mockRun,
     '/result': mockResultsResponse,
   });

Component Testing Patterns
--------------------------

Standard Test Structure
~~~~~~~~~~~~~~~~~~~~~~~

Every test file should follow this structure:

.. code-block:: javascript

   /* eslint-env jest */
   import { render, screen, waitFor } from '@testing-library/react';
   import userEvent from '@testing-library/user-event';
   import { MemoryRouter, Route, Routes } from 'react-router-dom';
   import { IbutsuContext } from '../components/contexts/ibutsu-context';
   import { HttpClient } from '../utilities/http';
   import { createMockProject, createMockRun } from '../test-utils';

   // Mock external dependencies
   jest.mock('../utilities/http');
   jest.mock('../pages/settings', () => ({
     Settings: { serverUrl: 'http://localhost:8080/api' },
   }));

   describe('ComponentName', () => {
     const mockProject = createMockProject();

     // Define a render helper for consistent setup
     const renderComponent = (props = {}, options = {}) => {
       const contextValue = {
         primaryObject: options.primaryObject ?? mockProject,
         darkTheme: false,
         setDarkTheme: jest.fn(),
         ...options.contextValue,
       };

       return render(
         <MemoryRouter initialEntries={[options.route ?? '/']}>
           <IbutsuContext.Provider value={contextValue}>
             <ComponentName {...props} />
           </IbutsuContext.Provider>
         </MemoryRouter>
       );
     };

     beforeEach(() => {
       jest.clearAllMocks();
       HttpClient.get.mockResolvedValue({ ok: true, json: async () => ({}) });
       HttpClient.handleResponse.mockImplementation(async (r) => r.json());
     });

     describe('Rendering', () => {
       it('should render component with required elements', async () => {
         renderComponent();
         await waitFor(() => {
           expect(screen.getByText('Expected Text')).toBeInTheDocument();
         });
       });
     });

     describe('Data Loading', () => {
       it('should fetch data on mount', async () => {
         renderComponent();
         await waitFor(() => {
           expect(HttpClient.get).toHaveBeenCalledWith(
             expect.arrayContaining(['http://localhost:8080/api']),
             expect.any(Object)
           );
         });
       });

       it('should handle API errors gracefully', async () => {
         HttpClient.get.mockRejectedValue(new Error('Network error'));
         const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

         renderComponent();

         await waitFor(() => {
           expect(consoleSpy).toHaveBeenCalled();
         });
         consoleSpy.mockRestore();
       });
     });

     describe('User Interactions', () => {
       it('should handle button click', async () => {
         const user = userEvent.setup();
         renderComponent();

         await user.click(screen.getByRole('button', { name: /submit/i }));

         expect(/* expected outcome */).toBeTruthy();
       });
     });
   });

Testing with Jenkins Metadata
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Components that display run or result metadata must be tested with both Jenkins and non-Jenkins data:

.. code-block:: javascript

   import { createMockJenkinsRun, createMockRunWithoutJenkins } from '../test-utils';

   describe('Jenkins Metadata Handling', () => {
     // Runs/results WITH Jenkins metadata
     const mockRunWithJenkins = createMockJenkinsRun({
       metadata: {
         jenkins: {
           job_name: 'test-pipeline/main',
           build_number: '123',
           build_url: 'https://jenkins.example.com/job/test-pipeline/123',
         },
         environment: { os: 'linux', python_version: '3.11' },
         git: { branch: 'main', commit: 'abc123' },
       },
     });

     // Runs/results WITHOUT Jenkins metadata
     const mockRunWithoutJenkins = createMockRunWithoutJenkins({
       metadata: {
         project: 'test-project',
         environment: { os: 'linux' },
       },
     });

     it('should display Jenkins metadata when present', async () => {
       HttpClient.get.mockResolvedValue({
         ok: true,
         json: async () => mockRunWithJenkins,
       });
       renderComponent();
       await waitFor(() => {
         expect(screen.getByText('test-pipeline/main')).toBeInTheDocument();
       });
     });

     it('should handle runs without Jenkins metadata', async () => {
       HttpClient.get.mockResolvedValue({
         ok: true,
         json: async () => mockRunWithoutJenkins,
       });
       renderComponent();
       // Should not crash, should render gracefully
       await waitFor(() => {
         expect(screen.queryByText('job_name')).not.toBeInTheDocument();
       });
     });

     it('should handle partial Jenkins metadata', async () => {
       const partialJenkins = createMockRun({
         metadata: {
           jenkins: { job_name: 'partial-job' },
           // build_number and build_url missing
         },
       });
       HttpClient.get.mockResolvedValue({
         ok: true,
         json: async () => partialJenkins,
       });
       renderComponent();
       await waitFor(() => {
         expect(screen.getByText('partial-job')).toBeInTheDocument();
       });
     });
   });

Multi-level Nested Metadata Testing
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Test components that render deeply nested metadata structures:

.. code-block:: javascript

   import { createMockResult } from '../test-utils';

   const mockResultWithNestedMetadata = createMockResult({
     metadata: {
       phase_durations: { setup: 0.1, call: 1.5, teardown: 0.05 },
       markers: ['smoke', 'ui', 'critical'],
       classification: { category: 'flaky', confidence: 0.85 },
       error: {
         type: 'AssertionError',
         message: 'Expected 200 but got 404',
         traceback: 'Traceback (most recent call last)...',
       },
       custom: {
         level1: {
           level2: {
             level3: 'deeply nested value',
           },
         },
       },
     },
   });

   it('should render nested metadata correctly', async () => {
     HttpClient.get.mockResolvedValue({
       ok: true,
       json: async () => mockResultWithNestedMetadata,
     });
     renderComponent();
     await waitFor(() => {
       expect(screen.getByText('AssertionError')).toBeInTheDocument();
     });
   });

Mocking Patterns
----------------

HttpClient Mocking
~~~~~~~~~~~~~~~~~~

Always mock ``HttpClient`` for API calls:

.. code-block:: javascript

   jest.mock('../utilities/http');

   beforeEach(() => {
     jest.clearAllMocks();

     // Basic successful response
     HttpClient.get.mockResolvedValue({
       ok: true,
       json: async () => mockData,
     });

     // Handle response processing
     HttpClient.handleResponse.mockImplementation(async (response) => {
       if (response.ok) {
         return response.json();
       }
       throw new Error('Response not ok');
     });
   });

   // Mock different endpoints
   HttpClient.get.mockImplementation((url) => {
     const urlString = Array.isArray(url) ? url.join('/') : url;

     if (urlString.includes('/run/')) {
       return Promise.resolve({
         ok: true,
         json: async () => mockRun,
       });
     }

     if (urlString.includes('/result')) {
       return Promise.resolve({
         ok: true,
         json: async () => mockResultsResponse,
       });
     }

     return Promise.resolve({
       ok: true,
       json: async () => ({}),
     });
   });

Mocking Child Components
~~~~~~~~~~~~~~~~~~~~~~~~

Mock heavy child components that are tested separately:

.. code-block:: javascript

   jest.mock('../components/filtering/filtered-table-card', () => {
     return function FilterTable() {
       return <div data-ouia-component-id="filter-table">Filter Table</div>;
     };
   });

   jest.mock('../components/result-view', () => {
     return function ResultView() {
       return <div data-ouia-component-id="result-view">Result View</div>;
     };
   });

Console Error Handling
~~~~~~~~~~~~~~~~~~~~~~

Suppress expected console errors in tests:

.. code-block:: javascript

   it('should handle API errors gracefully', async () => {
     HttpClient.get.mockRejectedValue(new Error('Network error'));
     const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

     renderComponent();

     await waitFor(() => {
       expect(consoleSpy).toHaveBeenCalled();
     });

     consoleSpy.mockRestore();
   });

Best Practices
--------------

Testing Library Queries
~~~~~~~~~~~~~~~~~~~~~~~

Use accessible queries in this priority order:

1. ``getByRole`` - Most accessible, semantic
2. ``getByLabelText`` - Form elements
3. ``getByPlaceholderText`` - Input placeholders
4. ``getByText`` - Visible text content
5. ``getByTestId`` / ``getByOuiaId`` - PatternFly components

.. code-block:: javascript

   // Preferred: accessible queries
   screen.getByRole('button', { name: /submit/i });
   screen.getByLabelText('Email');

   // For PatternFly OUIA components
   screen.getByTestId('filter-table-card');

Async Testing
~~~~~~~~~~~~~

Always use ``waitFor`` for async operations:

.. code-block:: javascript

   // Good: Wait for async content
   await waitFor(() => {
     expect(screen.getByText('Loaded Content')).toBeInTheDocument();
   });

   // Good: Wait for API calls
   await waitFor(() => {
     expect(HttpClient.get).toHaveBeenCalled();
   });

   // Avoid: Using arbitrary delays
   // await new Promise(resolve => setTimeout(resolve, 1000));

User Events
~~~~~~~~~~~

Use ``userEvent`` for realistic user interactions:

.. code-block:: javascript

   import userEvent from '@testing-library/user-event';

   it('should handle form submission', async () => {
     const user = userEvent.setup();
     renderComponent();

     await user.type(screen.getByLabelText('Email'), 'test@example.com');
     await user.type(screen.getByLabelText('Password'), 'password123');
     await user.click(screen.getByRole('button', { name: /login/i }));

     expect(HttpClient.post).toHaveBeenCalledWith(
       expect.any(Array),
       expect.objectContaining({ email: 'test@example.com' })
     );
   });

See Also
--------

* :doc:`backend-testing` - Backend testing guide with similar patterns
* `React Testing Library Documentation <https://testing-library.com/docs/react-testing-library/intro/>`_
* `Jest Documentation <https://jestjs.io/docs/getting-started>`_
