// Tests pour src/store/pipelineStore.js — actions, state, helpers
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock apiClient avant l'import du store
vi.mock('../../../src/api/client', () => ({
  apiClient: {
    startPipeline: vi.fn(() => Promise.resolve({ session_id: 'sess-1', status: 'started' })),
    validatePipeline: vi.fn(() => Promise.resolve({ status: 'resumed' })),
    sendChat: vi.fn(() => Promise.resolve({ reply: 'OK', sql_ddl: '', critic_review: '' })),
    executeQuery: vi.fn(() => Promise.resolve({ success: true, sql: 'SELECT 1', columns: ['x'], rows: [[1]], total_rows: 1 })),
  },
}));

import { usePipelineStore, AGENT_STATUS, AGENT_ORDER } from '../../../src/store/pipelineStore';

describe('pipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.getState().resetPipeline();
  });

  describe('initial state', () => {
    it('has idle status by default', () => {
      expect(usePipelineStore.getState().pipelineStatus).toBe('idle');
    });

    it('has all agents in IDLE state', () => {
      const { agentStatuses } = usePipelineStore.getState();
      AGENT_ORDER.forEach(a => {
        expect(agentStatuses[a]).toBe(AGENT_STATUS.IDLE);
      });
    });

    it('has no messages initially', () => {
      expect(usePipelineStore.getState().messages).toEqual([]);
    });
  });

  describe('setAuth', () => {
    it('stores token and userId', () => {
      usePipelineStore.getState().setAuth('tok-abc', 42, 'myprefix');
      const s = usePipelineStore.getState();
      expect(s.authToken).toBe('tok-abc');
      expect(s.userId).toBe(42);
      expect(s.userPrefix).toBe('myprefix');
    });

    it('persists to localStorage', () => {
      usePipelineStore.getState().setAuth('tok-x', 1, 'dw');
      expect(localStorage.getItem('auth_token')).toBe('tok-x');
      expect(localStorage.getItem('user_id')).toBe('1');
    });
  });

  describe('logout', () => {
    it('clears auth and resets pipeline', () => {
      usePipelineStore.getState().setAuth('tok', 1, 'dw');
      usePipelineStore.getState().logout();
      const s = usePipelineStore.getState();
      expect(s.authToken).toBeNull();
      expect(s.userId).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('addMessage', () => {
    it('appends a message', () => {
      usePipelineStore.getState().addMessage('user', 'hello');
      const msgs = usePipelineStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('hello');
    });

    it('keeps order on multiple calls', () => {
      const s = usePipelineStore.getState();
      s.addMessage('user', 'a');
      s.addMessage('assistant', 'b');
      s.addMessage('user', 'c');
      expect(usePipelineStore.getState().messages.map(m => m.content)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('resetPipeline', () => {
    it('clears messages and resets status', () => {
      const s = usePipelineStore.getState();
      s.addMessage('user', 'x');
      s.resetPipeline();
      const fresh = usePipelineStore.getState();
      expect(fresh.messages).toEqual([]);
      expect(fresh.pipelineStatus).toBe('idle');
    });
  });
});
