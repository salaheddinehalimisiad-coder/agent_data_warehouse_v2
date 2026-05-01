// Tests pour ExportPanel.jsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../src/api/client', () => ({
  apiClient: { getHeaders: () => ({}) },
}));

const mockState = {
  sessionId: 'sess-test-12345', pipelineStatus: 'complete',
  etlStatus: 'success', userPrefix: 'mydw', sqlDDL: 'CREATE TABLE foo;',
};
vi.mock('../../../src/store/pipelineStore', () => ({
  usePipelineStore: (selector) => {
    if (typeof selector === 'function') return selector(mockState);
    return mockState;
  },
}));

import ExportPanel from '../../../src/components/ExportPanel';

describe('ExportPanel', () => {
  it('renders 5 export options', () => {
    render(<ExportPanel />);
    expect(screen.getByText(/Rapport Excel/)).toBeInTheDocument();
    expect(screen.getByText(/CSV Bundle/)).toBeInTheDocument();
    expect(screen.getByText(/Structural JSON/)).toBeInTheDocument();
    expect(screen.getByText(/Logical Schema/)).toBeInTheDocument();
    expect(screen.getByText(/Backup SQL Server/)).toBeInTheDocument();
  });

  it('shows correct file extensions', () => {
    render(<ExportPanel />);
    expect(screen.getByText('.xlsx')).toBeInTheDocument();
    expect(screen.getByText('.zip')).toBeInTheDocument();
    expect(screen.getByText('.json')).toBeInTheDocument();
    expect(screen.getByText('.sql')).toBeInTheDocument();
    expect(screen.getByText('.bak')).toBeInTheDocument();
  });

  it('shows 10 sheets sub-label for Excel', () => {
    render(<ExportPanel />);
    expect(screen.getByText(/10 feuilles/)).toBeInTheDocument();
  });

  it('shows session id in header', () => {
    render(<ExportPanel />);
    expect(screen.getByText(/sess-test-123/)).toBeInTheDocument();
  });

  it('shows pipeline-complete status', () => {
    render(<ExportPanel />);
    expect(screen.getByText(/Pipeline complet/)).toBeInTheDocument();
  });
});
