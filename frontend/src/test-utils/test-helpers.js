// Test helpers for frontend tests
// Provides rendering utilities and common test setup

import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import { FilterContext } from '../components/contexts/filter-context';
import { HttpClient } from '../utilities/http';

/**
 * Render a component with Router context
 * @param {React.Component} ui - Component to render
 * @param {Object} options - Options
 * @param {string} options.initialRoute - Initial route
 * @param {Array} options.routes - Route configurations
 * @returns {Object} Render result
 */
export function renderWithRouter(ui, { initialRoute = '/', routes = [] } = {}) {
  const initialEntries = Array.isArray(initialRoute)
    ? initialRoute
    : [initialRoute];

  const wrappedUi =
    routes.length > 0 ? (
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          {routes.map((route, index) => (
            <Route key={index} path={route.path} element={route.element} />
          ))}
        </Routes>
      </MemoryRouter>
    ) : (
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    );

  return render(wrappedUi);
}

/**
 * Render a component with IbutsuContext
 * @param {React.Component} ui - Component to render
 * @param {Object} contextValue - Context value overrides
 * @returns {Object} Render result
 */
export function renderWithIbutsuContext(ui, contextValue = {}) {
  const defaultContextValue = {
    primaryObject: null,
    defaultDashboard: null,
    primaryType: 'project',
    setPrimaryType: jest.fn(),
    setPrimaryObject: jest.fn(),
    setDefaultDashboard: jest.fn(),
    darkTheme: false,
    setDarkTheme: jest.fn(),
    ...contextValue,
  };

  return render(
    <IbutsuContext.Provider value={defaultContextValue}>
      {ui}
    </IbutsuContext.Provider>,
  );
}

/**
 * Render a component with both Router and IbutsuContext
 * @param {React.Component} ui - Component to render
 * @param {Object} options - Options
 * @param {string} options.initialRoute - Initial route
 * @param {Array} options.routes - Route configurations
 * @param {Object} options.contextValue - Context value overrides
 * @returns {Object} Render result
 */
export function renderWithRouterAndContext(
  ui,
  { initialRoute = '/', routes = [], contextValue = {} } = {},
) {
  const defaultContextValue = {
    primaryObject: null,
    defaultDashboard: null,
    primaryType: 'project',
    setPrimaryType: jest.fn(),
    setPrimaryObject: jest.fn(),
    setDefaultDashboard: jest.fn(),
    darkTheme: false,
    setDarkTheme: jest.fn(),
    ...contextValue,
  };

  const initialEntries = Array.isArray(initialRoute)
    ? initialRoute
    : [initialRoute];

  const wrappedUi =
    routes.length > 0 ? (
      <MemoryRouter initialEntries={initialEntries}>
        <IbutsuContext.Provider value={defaultContextValue}>
          <Routes>
            {routes.map((route, index) => (
              <Route key={index} path={route.path} element={route.element} />
            ))}
          </Routes>
        </IbutsuContext.Provider>
      </MemoryRouter>
    ) : (
      <MemoryRouter initialEntries={initialEntries}>
        <IbutsuContext.Provider value={defaultContextValue}>
          {ui}
        </IbutsuContext.Provider>
      </MemoryRouter>
    );

  return render(wrappedUi);
}

/**
 * Render a component with all common providers (Router, IbutsuContext, FilterContext)
 * @param {React.Component} ui - Component to render
 * @param {Object} options - Options
 * @param {string|Array} options.initialRoute - Initial route or array of routes
 * @param {Array} options.routes - Route configurations for Routes component
 * @param {Object} options.ibutsuContext - IbutsuContext value overrides
 * @param {Object} options.filterContext - FilterContext value overrides
 * @returns {Object} Render result
 */
export function renderWithAllProviders(
  ui,
  {
    initialRoute = '/',
    routes = [],
    ibutsuContext = {},
    filterContext = {},
  } = {},
) {
  const defaultIbutsuContext = {
    primaryObject: null,
    defaultDashboard: null,
    primaryType: 'project',
    setPrimaryType: jest.fn(),
    setPrimaryObject: jest.fn(),
    setDefaultDashboard: jest.fn(),
    darkTheme: false,
    setDarkTheme: jest.fn(),
    ...ibutsuContext,
  };

  const defaultFilterContext = {
    activeFilters: [],
    setActiveFilters: jest.fn(),
    clearFilters: jest.fn(),
    updateFilters: jest.fn(),
    onRemoveFilter: jest.fn(),
    ...filterContext,
  };

  const initialEntries = Array.isArray(initialRoute)
    ? initialRoute
    : [initialRoute];

  const wrappedUi =
    routes.length > 0 ? (
      <MemoryRouter initialEntries={initialEntries}>
        <IbutsuContext.Provider value={defaultIbutsuContext}>
          <FilterContext.Provider value={defaultFilterContext}>
            <Routes>
              {routes.map((route, index) => (
                <Route key={index} path={route.path} element={route.element} />
              ))}
            </Routes>
          </FilterContext.Provider>
        </IbutsuContext.Provider>
      </MemoryRouter>
    ) : (
      <MemoryRouter initialEntries={initialEntries}>
        <IbutsuContext.Provider value={defaultIbutsuContext}>
          <FilterContext.Provider value={defaultFilterContext}>
            {ui}
          </FilterContext.Provider>
        </IbutsuContext.Provider>
      </MemoryRouter>
    );

  return render(wrappedUi);
}

/**
 * Setup HttpClient mocks declaratively based on URL patterns
 * @param {Object} responseMap - Map of URL patterns to response data
 * @example
 * mockHttpClientResponses({
 *   '/run/': mockRun,
 *   '/result': mockResultsResponse,
 *   '/project': mockProject,
 * });
 */
export function mockHttpClientResponses(responseMap) {
  HttpClient.get.mockImplementation((url) => {
    const urlPath = Array.isArray(url) ? url.join('/') : url;

    for (const [pattern, response] of Object.entries(responseMap)) {
      if (urlPath.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          json: async () => response,
        });
      }
    }

    // Default empty response
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    });
  });

  HttpClient.handleResponse.mockImplementation(async (response) => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Response not ok');
  });
}

/**
 * Create a mock HttpClient with common methods
 * @param {Object} mockResponses - Mock responses for different methods
 * @returns {Object} Mock HttpClient
 */
export function createMockHttpClient(mockResponses = {}) {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    handleResponse: jest.fn(async (response) => {
      if (response.ok) {
        return response.json ? response.json() : response;
      }
      throw new Error('Response not ok');
    }),
    ...mockResponses,
  };
}

/**
 * Create a successful mock fetch response
 * @param {*} data - Data to return
 * @returns {Object} Mock response
 */
export function createMockResponse(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}

/**
 * Create an error mock fetch response
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @returns {Object} Mock error response
 */
export function createMockErrorResponse(
  status = 500,
  message = 'Internal Server Error',
) {
  return {
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: message }),
  };
}

/**
 * Delay execution for testing async behavior
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after delay
 */
export function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock localStorage for tests
 * @returns {Object} Mock localStorage object
 */
export function createMockLocalStorage() {
  let store = {};

  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
}

/**
 * Mock console methods for tests
 * @param {Array} methods - Console methods to mock
 * @returns {Object} Spy objects for each method
 */
export function mockConsoleMethods(methods = ['log', 'error', 'warn']) {
  const spies = {};
  methods.forEach((method) => {
    spies[method] = jest.spyOn(console, method).mockImplementation(() => {});
  });
  return spies;
}

/**
 * Restore console methods after mocking
 * @param {Object} spies - Spy objects to restore
 */
export function restoreConsoleMethods(spies) {
  Object.values(spies).forEach((spy) => spy.mockRestore());
}

/**
 * Create auth headers for API requests
 * @param {string} token - JWT token
 * @returns {Object} Headers object
 */
export function createAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Mock window.matchMedia for theme tests
 * @param {boolean} matches - Whether the media query matches
 */
export function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

/**
 * Setup common test environment
 * @returns {Object} Cleanup functions
 */
export function setupTestEnvironment() {
  const originalLocalStorage = global.localStorage;
  const mockLocalStorage = createMockLocalStorage();
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });

  const cleanup = () => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  };

  return { cleanup, mockLocalStorage };
}
