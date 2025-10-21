/* eslint-env jest */
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResultView from './result-view';
import { IbutsuContext } from './contexts/ibutsu-context';
import { HttpClient } from '../utilities/http';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock ClassificationDropdown
jest.mock('./classification-dropdown', () => ({
  ClassificationDropdown: () => (
    <div data-testid="classification-dropdown">Classification Dropdown</div>
  ),
}));

// Mock TestHistoryTable
jest.mock('./test-history', () => {
  return function TestHistoryTable() {
    return <div data-testid="test-history-table">Test History Table</div>;
  };
});

// Mock ArtifactTab
jest.mock('./artifact-tab', () => {
  return function ArtifactTab() {
    return <div data-testid="artifact-tab">Artifact Tab</div>;
  };
});

// Mock TabTitle
jest.mock('./tab-title', () => {
  // eslint-disable-next-line react/prop-types
  return function TabTitle({ text }) {
    return <div>{text}</div>;
  };
});

describe('ResultView Component - Continuous Rendering Issue', () => {
  const mockResult = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    test_id: 'test_example',
    result: 'failed',
    duration: 10.5,
    start_time: '2025-10-21T12:00:00Z',
    run_id: '650e8400-e29b-41d4-a716-446655440001',
    component: 'ccx',
    source: 'jenkins',
    env: 'prod',
    metadata: {
      exception_name: 'AssertionError',
      importance: 'high',
    },
  };

  const mockArtifacts = {
    artifacts: [
      {
        id: '750e8400-e29b-41d4-a716-446655440001',
        filename: 'test.log',
        result_id: '550e8400-e29b-41d4-a716-446655440000',
      },
    ],
  };

  const renderResultView = ({
    testResult = mockResult,
    defaultTab = 'summary',
    hideTestHistory = false,
    skipHash = false,
  } = {}) => {
    const contextValue = {
      darkTheme: false,
      setDarkTheme: jest.fn(),
    };

    return render(
      <MemoryRouter
        initialEntries={[
          '/project/550e8400-e29b-41d4-a716-446655440000/result/550e8400-e29b-41d4-a716-446655440000',
        ]}
      >
        <IbutsuContext.Provider value={contextValue}>
          <Routes>
            <Route
              path="/project/:project_id/result/:result_id"
              element={
                <ResultView
                  testResult={testResult}
                  defaultTab={defaultTab}
                  hideTestHistory={hideTestHistory}
                  skipHash={skipHash}
                />
              }
            />
          </Routes>
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for HttpClient.get - artifacts endpoint
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockArtifacts,
    });

    // Default mock for HttpClient.handleResponse
    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  it('should NOT make repeated API calls when rendering with the same testResult', async () => {
    // This test should FAIL initially, demonstrating the bug
    // After the fix, it should PASS

    renderResultView({ skipHash: true });

    // Wait for initial artifact fetch
    await waitFor(
      () => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'artifact'],
          { resultId: mockResult.id },
        );
      },
      { timeout: 1000 },
    );

    // Get the initial call count
    const initialCallCount = HttpClient.get.mock.calls.length;

    // Wait a bit to see if more calls are made
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    // The call count should remain the same - no additional calls
    const finalCallCount = HttpClient.get.mock.calls.length;

    // This assertion will FAIL if there are continuous renders causing repeated API calls
    expect(finalCallCount).toBe(initialCallCount);
    expect(finalCallCount).toBe(1); // Should only be called once
  });

  it('should NOT cause infinite re-renders when testResult prop changes reference but has same data', async () => {
    // This test demonstrates the issue when parent component re-renders
    // and passes a new object reference with the same data

    const { rerender } = renderResultView({ skipHash: true });

    // Wait for initial render and artifact fetch
    await waitFor(
      () => {
        expect(HttpClient.get).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 },
    );

    // Clear mocks to track new calls
    jest.clearAllMocks();

    // Rerender with a new object reference but same data
    const sameDataNewReference = { ...mockResult };

    const contextValue = {
      darkTheme: false,
      setDarkTheme: jest.fn(),
    };

    rerender(
      <MemoryRouter
        initialEntries={[
          '/project/550e8400-e29b-41d4-a716-446655440000/result/550e8400-e29b-41d4-a716-446655440000',
        ]}
      >
        <IbutsuContext.Provider value={contextValue}>
          <Routes>
            <Route
              path="/project/:project_id/result/:result_id"
              element={
                <ResultView
                  testResult={sameDataNewReference}
                  defaultTab="summary"
                  hideTestHistory={false}
                  skipHash={true}
                />
              }
            />
          </Routes>
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );

    // Wait a bit to see if the component makes unnecessary API calls
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    // Should NOT make another API call since the result ID hasn't changed
    // This will FAIL if the component doesn't properly check for actual changes
    expect(HttpClient.get).not.toHaveBeenCalled();
  });

  it('should make a new API call only when testResult.id actually changes', async () => {
    const { rerender } = renderResultView({ skipHash: true });

    // Wait for initial render and artifact fetch
    await waitFor(
      () => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'artifact'],
          { resultId: mockResult.id },
        );
      },
      { timeout: 1000 },
    );

    // Clear mocks
    jest.clearAllMocks();

    // Now change to a different result with a different ID
    const differentResult = {
      ...mockResult,
      id: '550e8400-e29b-41d4-a716-446655440099',
    };

    const contextValue = {
      darkTheme: false,
      setDarkTheme: jest.fn(),
    };

    rerender(
      <MemoryRouter
        initialEntries={[
          '/project/550e8400-e29b-41d4-a716-446655440000/result/550e8400-e29b-41d4-a716-446655440099',
        ]}
      >
        <IbutsuContext.Provider value={contextValue}>
          <Routes>
            <Route
              path="/project/:project_id/result/:result_id"
              element={
                <ResultView
                  testResult={differentResult}
                  defaultTab="summary"
                  hideTestHistory={false}
                  skipHash={true}
                />
              }
            />
          </Routes>
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );

    // Should make a new API call since the result ID changed
    await waitFor(
      () => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'artifact'],
          { resultId: differentResult.id },
        );
      },
      { timeout: 1000 },
    );

    // Should be called exactly once for the new result
    expect(HttpClient.get).toHaveBeenCalledTimes(1);
  });

  it('should render Summary tab without continuous re-renders', async () => {
    renderResultView({ skipHash: true });

    // Wait for component to render and initial artifact fetch
    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(HttpClient.get).toHaveBeenCalledWith(
        ['http://localhost:8080/api', 'artifact'],
        { resultId: mockResult.id },
      );
    });

    // Get the call count after initial render
    const initialCallCount = HttpClient.get.mock.calls.length;

    // Wait to ensure no additional renders trigger API calls
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    const finalCallCount = HttpClient.get.mock.calls.length;

    // Should not have made additional calls after the initial fetch
    expect(finalCallCount).toBe(initialCallCount);
    // Should have been called exactly once for the initial fetch
    expect(finalCallCount).toBe(1);
  });
});
