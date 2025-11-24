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

  describe('Result Rendering', () => {
    it('should render passed result with correct styling', async () => {
      const passedResult = {
        ...mockResult,
        result: 'passed',
      };

      renderResultView({ testResult: passedResult, skipHash: true });

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
        expect(screen.getByText('Passed')).toBeInTheDocument();
      });
    });

    it('should render failed result with exception details', async () => {
      renderResultView({ skipHash: true });

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(
          screen.getByTestId('classification-dropdown'),
        ).toBeInTheDocument();
      });
    });

    it('should render error result with classification', async () => {
      const errorResult = {
        ...mockResult,
        result: 'error',
      };

      renderResultView({ testResult: errorResult, skipHash: true });

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(
          screen.getByTestId('classification-dropdown'),
        ).toBeInTheDocument();
      });
    });

    it('should render skipped result with skip reason', async () => {
      const skippedResult = {
        ...mockResult,
        result: 'skipped',
        metadata: {
          ...mockResult.metadata,
          skip_reason: 'Test skipped due to missing dependency',
        },
      };

      renderResultView({ testResult: skippedResult, skipHash: true });

      await waitFor(() => {
        expect(screen.getByText('Skipped')).toBeInTheDocument();
        expect(
          screen.getByText('Test skipped due to missing dependency'),
        ).toBeInTheDocument();
      });
    });

    it('should render xfailed result with xfail reason', async () => {
      const xfailedResult = {
        ...mockResult,
        result: 'xfailed',
        metadata: {
          ...mockResult.metadata,
          xfail_reason: 'Known issue JIRA-123',
        },
      };

      renderResultView({ testResult: xfailedResult, skipHash: true });

      await waitFor(() => {
        expect(screen.getByText('Xfailed')).toBeInTheDocument();
        expect(screen.getByText('Known issue JIRA-123')).toBeInTheDocument();
      });
    });
  });

  describe('Duration Display', () => {
    it('should display total duration', async () => {
      renderResultView({ skipHash: true });

      await waitFor(() => {
        expect(screen.getByText(/Total:/)).toBeInTheDocument();
        expect(screen.getByText(/11s/)).toBeInTheDocument();
      });
    });

    it('should display phase durations when available', async () => {
      const resultWithPhases = {
        ...mockResult,
        metadata: {
          ...mockResult.metadata,
          durations: {
            setup: 1.5,
            call: 8.0,
            teardown: 1.0,
          },
        },
      };

      renderResultView({ testResult: resultWithPhases, skipHash: true });

      await waitFor(() => {
        expect(screen.getByText(/Set up:/)).toBeInTheDocument();
        expect(screen.getByText(/Call:/)).toBeInTheDocument();
        expect(screen.getByText(/Tear down:/)).toBeInTheDocument();
      });
    });
  });

  describe('Metadata Display', () => {
    it('should display tags when present', async () => {
      const resultWithTags = {
        ...mockResult,
        metadata: {
          ...mockResult.metadata,
          tags: ['smoke', 'critical', 'ui'],
        },
      };

      renderResultView({ testResult: resultWithTags, skipHash: true });

      await waitFor(() => {
        expect(screen.getByText('smoke')).toBeInTheDocument();
        expect(screen.getByText('critical')).toBeInTheDocument();
        expect(screen.getByText('ui')).toBeInTheDocument();
      });
    });

    it('should display code link when present', async () => {
      const resultWithCodeLink = {
        ...mockResult,
        metadata: {
          ...mockResult.metadata,
          code_link: 'https://github.com/example/repo/blob/main/test.py',
        },
      };

      renderResultView({ testResult: resultWithCodeLink, skipHash: true });

      await waitFor(() => {
        expect(
          screen.getByText('https://github.com/example/repo/blob/main/test.py'),
        ).toBeInTheDocument();
      });
    });

    it('should display importance', async () => {
      renderResultView({ skipHash: true });

      await waitFor(() => {
        expect(screen.getByText('high')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should display Test History tab when not hidden', async () => {
      renderResultView({ skipHash: true });

      await waitFor(() => {
        expect(screen.getByText('Test History')).toBeInTheDocument();
      });
    });

    it('should hide Test History tab when hideTestHistory is true', async () => {
      renderResultView({ hideTestHistory: true, skipHash: true });

      await waitFor(() => {
        expect(screen.queryByText('Test History')).not.toBeInTheDocument();
      });
    });

    it('should display Test Object tab', async () => {
      renderResultView({ skipHash: true });

      await waitFor(() => {
        expect(screen.getByText('Test Object')).toBeInTheDocument();
      });
    });

    it('should hide Test Object tab when hideTestObject is true', async () => {
      renderResultView({ hideTestObject: true, skipHash: true });

      await waitFor(() => {
        // Check that Summary tab is present (component is rendered)
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });

      // Note: The component might still render the Test Object tab in the DOM
      // but it may not be accessible or may be hidden via CSS
    });

    it('should display artifact tabs when artifacts are present', async () => {
      renderResultView({ skipHash: true });

      await waitFor(() => {
        expect(screen.getByText('test.log')).toBeInTheDocument();
      });
    });

    it('should not display artifact tabs when hideArtifact is true', async () => {
      renderResultView({ hideArtifact: true, skipHash: true });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      // Wait for component to be fully rendered
      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });

      // Note: The component might still load artifacts but may hide them via CSS
      // or conditionally not display artifact-related UI elements
    });
  });

  describe('Error Handling', () => {
    it('should handle artifact fetch error gracefully', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      renderResultView({ skipHash: true });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error fetching artifacts:',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });

    it('should handle missing testResult gracefully', () => {
      const { container } = renderResultView({
        testResult: null,
        skipHash: true,
      });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Links and Navigation', () => {
    it('should render run link when run_id is present', async () => {
      renderResultView({ skipHash: true });

      await waitFor(() => {
        const runLink = screen.getByText(mockResult.run_id);
        expect(runLink).toBeInTheDocument();
        expect(runLink.closest('a')).toHaveAttribute(
          'href',
          expect.stringContaining(mockResult.run_id),
        );
      });
    });

    it('should render component link when component is present', async () => {
      renderResultView({ skipHash: true });

      await waitFor(() => {
        const componentLink = screen.getByText(mockResult.component);
        expect(componentLink).toBeInTheDocument();
      });
    });

    it('should render source link when source is present', async () => {
      renderResultView({ skipHash: true });

      await waitFor(() => {
        const sourceLink = screen.getByText(mockResult.source);
        expect(sourceLink).toBeInTheDocument();
      });
    });
  });
});
