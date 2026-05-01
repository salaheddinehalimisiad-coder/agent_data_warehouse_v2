// Tests pour FloatingChatWidget.jsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock apiClient et store
vi.mock('../../../src/api/client', () => ({
  apiClient: {
    sendChat: vi.fn(() => Promise.resolve({ reply: 'OK' })),
    sendChatStream: vi.fn(() => Promise.resolve(() => {})),
  },
}));

// Mock store with controllable state
const mockState = {
  messages: [], pipelineStatus: 'idle', currentAgent: null,
  sqlDDL: '', etlCode: '', criticReview: '', etlStatus: 'pending',
  sendMessage: vi.fn(),
};
vi.mock('../../../src/store/pipelineStore', () => ({
  usePipelineStore: (selector) => {
    if (typeof selector === 'function') return selector(mockState);
    return mockState;
  },
}));

// Mock ChatInterface (heavy lazy component)
vi.mock('../../../src/components/ChatInterface', () => ({
  default: () => <div data-testid="chat-interface">Chat content</div>,
}));

import FloatingChatWidget from '../../../src/components/FloatingChatWidget';

describe('FloatingChatWidget', () => {
  it('renders the floating button when closed', () => {
    render(<FloatingChatWidget />);
    const btn = screen.getByLabelText(/Ouvrir l'Assistant IA/);
    expect(btn).toBeInTheDocument();
  });

  it('opens panel on button click', async () => {
    render(<FloatingChatWidget />);
    const btn = screen.getByLabelText(/Ouvrir l'Assistant IA/);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Atlas')).toBeInTheDocument();
    });
  });

  it('shows BLAZE GLM-5 in footer', async () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByLabelText(/Ouvrir l'Assistant IA/));
    await waitFor(() => {
      expect(screen.getByText(/BLAZE GLM-5/)).toBeInTheDocument();
    });
  });

  it('closes when X button is clicked', async () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByLabelText(/Ouvrir l'Assistant IA/));
    await waitFor(() => screen.getByText('Atlas'));

    const closeBtn = screen.getByTitle(/Fermer/);
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText('Atlas')).not.toBeInTheDocument();
    });
  });

  it('shows status "disponible" when idle', async () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByLabelText(/Ouvrir l'Assistant IA/));
    await waitFor(() => {
      expect(screen.getByText(/disponible/)).toBeInTheDocument();
    });
  });
});
