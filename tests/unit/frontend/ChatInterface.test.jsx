// Tests pour ChatInterface.jsx — etat vide, envoi, suggestions
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockState = {
  messages: [], sqlDDL: '', etlCode: '', criticReview: '', etlStatus: 'pending',
  pipelineStatus: 'running',  // canChat = true
  sendMessage: vi.fn(),
};
vi.mock('../../../src/store/pipelineStore', () => ({
  usePipelineStore: (selector) => {
    if (typeof selector === 'function') return selector(mockState);
    return mockState;
  },
}));

import ChatInterface from '../../../src/components/ChatInterface';

describe('ChatInterface', () => {
  it('shows Atlas greeting when no messages', () => {
    render(<ChatInterface />);
    expect(screen.getByText(/Bonjour, je suis Atlas/)).toBeInTheDocument();
  });

  it('displays suggested prompts', () => {
    render(<ChatInterface />);
    expect(screen.getByText(/net_amount/)).toBeInTheDocument();
    expect(screen.getByText(/dim_customer/)).toBeInTheDocument();
  });

  it('input field accepts text', () => {
    render(<ChatInterface />);
    const ta = screen.getByPlaceholderText(/Demande a Atlas/);
    fireEvent.change(ta, { target: { value: 'test message' } });
    expect(ta.value).toBe('test message');
  });

  it('renders keyboard shortcut hints', () => {
    render(<ChatInterface />);
    expect(screen.getByText(/pour envoyer/)).toBeInTheDocument();
    expect(screen.getByText(/nouvelle ligne/)).toBeInTheDocument();
  });

  it('does NOT render old tabs (INTELLIGENCE, AUDIT)', () => {
    render(<ChatInterface />);
    expect(screen.queryByText('INTELLIGENCE')).not.toBeInTheDocument();
    expect(screen.queryByText('AUDIT')).not.toBeInTheDocument();
    expect(screen.queryByText('PENTAHO XML')).not.toBeInTheDocument();
  });

  it('does NOT render old SYSTEM SECURE footer', () => {
    render(<ChatInterface />);
    expect(screen.queryByText(/SYSTEM/)).not.toBeInTheDocument();
    expect(screen.queryByText(/COPILOT ACTIVE/)).not.toBeInTheDocument();
  });

  it('clicks suggestion to fill input', () => {
    render(<ChatInterface />);
    const sugg = screen.getByText(/net_amount/);
    fireEvent.click(sugg);
    const ta = screen.getByPlaceholderText(/Demande a Atlas/);
    expect(ta.value).toContain('net_amount');
  });
});
