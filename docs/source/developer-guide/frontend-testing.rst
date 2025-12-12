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

PatternFly Component Testing
----------------------------

Understanding OUIA (Open UI Automation)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

PatternFly components implement OUIA attributes for automated testing. The frontend is configured to use ``data-ouia-component-id`` as the test ID attribute (see ``setupTests.js``).

.. code-block:: javascript

   // setupTests.js configures this:
   configure({ testIdAttribute: 'data-ouia-component-id' });

   // This means getByTestId() looks for data-ouia-component-id
   expect(screen.getByTestId('my-component')).toBeInTheDocument();

Components Supporting ``ouiaId`` Prop
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

These PatternFly components support the ``ouiaId`` prop, which automatically sets ``data-ouia-component-id``:

**Core Components:**

* Alert, Button, Card, Modal, Pagination, Toolbar

**Navigation:**

* Breadcrumb, Nav, NavItem, NavExpandable

**Form Controls:**

* Checkbox, Radio, Switch, TextInput, FormSelect

**Menus:**

* Dropdown, DropdownItem, Menu, MenuToggle, Select

**Content:**

* Content, Title, ClipboardCopy

**Tabs:**

* Tab, Tabs, TabContent

Components WITHOUT ``ouiaId`` Support
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

These components do **NOT** support the ``ouiaId`` prop. Use ``data-ouia-component-id`` directly only when necessary:

**Card Sub-components:**

* CardBody, CardHeader, CardFooter, CardTitle

**Modal Sub-components:**

* ModalBody, ModalHeader

**Toolbar Sub-components:**

* ToolbarItem, ToolbarGroup, ToolbarContent

**Layout Components:**

* Grid, GridItem, Flex, FlexItem, PageSection

Test Locator Strategy
~~~~~~~~~~~~~~~~~~~~~~

**Preferred: Use ``ouiaId`` on Parent Components**

.. code-block:: javascript

   // Component
   <Card ouiaId="test-card">
     <CardBody>
       <Button>Click Me</Button>
     </CardBody>
   </Card>

   // Test - use relative locators from parent
   const card = screen.getByTestId('test-card');
   const button = within(card).getByRole('button', { name: /click me/i });

**Use ``data-ouia-component-id`` Only When Necessary**

.. code-block:: javascript

   // Component - only when relative locators won't work
   <CardBody data-ouia-component-id="special-card-body">
     <div>Complex content</div>
   </CardBody>

   // Test
   expect(screen.getByTestId('special-card-body')).toBeInTheDocument();

PatternFly Component Examples
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Testing Modal with OUIA:**

.. code-block:: javascript

   // Component
   <Modal ouiaId="edit-modal">
     <ModalHeader>
       <Title ouiaId="edit-modal-title">Edit Item</Title>
     </ModalHeader>
     <ModalBody>
       <TextInput ouiaId="item-name-input" />
     </ModalBody>
   </Modal>

   // Test
   it('should render modal with input', () => {
     renderComponent();

     const modal = screen.getByTestId('edit-modal');
     expect(modal).toBeInTheDocument();

     const input = screen.getByTestId('item-name-input');
     expect(input).toBeInTheDocument();
   });

**Testing Card with OUIA:**

.. code-block:: javascript

   // Component
   <Card ouiaId="results-card">
     <CardBody>
       <Content>Results: 100</Content>
     </CardBody>
   </Card>

   // Test
   it('should display results in card', () => {
     renderComponent();

     const card = screen.getByTestId('results-card');
     expect(within(card).getByText(/results: 100/i)).toBeInTheDocument();
   });

**Testing Button with OUIA:**

.. code-block:: javascript

   // Component
   <Button
     ouiaId="submit-button"
     onClick={handleSubmit}
   >
     Submit
   </Button>

   // Test
   it('should handle button click', async () => {
     const user = userEvent.setup();
     renderComponent();

     const button = screen.getByTestId('submit-button');
     await user.click(button);

     expect(mockHandleSubmit).toHaveBeenCalled();
   });

Checking Component Support for ``ouiaId``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To verify if a PatternFly component supports ``ouiaId``:

1. Check the component's TypeScript interface in ``node_modules/@patternfly/react-core/src/components/``
2. Look for ``extends OUIAProps`` in the interface definition
3. Refer to the list in ``AGENTS.md`` for quick reference

.. code-block:: typescript

   // Example: Card supports ouiaId
   export interface CardProps extends React.HTMLProps<HTMLElement>, OUIAProps {
     ouiaId?: number | string;
     // ...
   }

   // Example: CardBody does NOT support ouiaId
   export interface CardBodyProps extends React.HTMLProps<HTMLDivElement> {
     // No OUIAProps extension
     // ...
   }

Mocking PatternFly Components in Tests
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When mocking PatternFly components, include ``data-ouia-component-id`` for test compatibility:

.. code-block:: javascript

   jest.mock('../components/my-component', () => {
     return function MyComponent({ title, ouiaId }) {
       return (
         <div data-ouia-component-id={ouiaId || 'my-component'}>
           {title}
         </div>
       );
     };
   });

Common Pitfalls
~~~~~~~~~~~~~~~

**Don't use ``ouiaId`` on unsupported components:**

.. code-block:: javascript

   // Bad: CardBody doesn't support ouiaId
   <CardBody ouiaId="card-body">
     Content
   </CardBody>

   // Good: Use data-ouia-component-id if needed
   <CardBody data-ouia-component-id="card-body">
     Content
   </CardBody>

   // Better: Use relative locator from parent Card
   <Card ouiaId="my-card">
     <CardBody>
       Content
     </CardBody>
   </Card>

**Don't use ``data-id`` for test selectors:**

The ``data-id`` attribute is obsolete for testing. Use ``data-ouia-component-id`` or ``ouiaId`` prop instead.

.. code-block:: javascript

   // Bad: Legacy data-id (pre-OUIA)
   <div data-id="my-component">Content</div>

   // Good: Use data-ouia-component-id
   <div data-ouia-component-id="my-component">Content</div>

   // Better: Use ouiaId on PatternFly components
   <Card ouiaId="my-component">Content</Card>

**Note:** The ``data-id`` attribute may still appear in CSS selectors for styling purposes (e.g., ``div.ibutsu-widget-header``), but should never be used for test selectors.

See Also
--------

* :doc:`backend-testing` - Backend testing guide with similar patterns
* `React Testing Library Documentation <https://testing-library.com/docs/react-testing-library/intro/>`_
* `Jest Documentation <https://jestjs.io/docs/getting-started>`_
* `PatternFly Components <https://www.patternfly.org/components/all-components>`_
* ``AGENTS.md`` - Agent instructions including PatternFly OUIA guidance
