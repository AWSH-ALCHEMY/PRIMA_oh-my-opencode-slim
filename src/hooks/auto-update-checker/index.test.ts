import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { PluginInput } from '@opencode-ai/plugin';

// Mock the logger first (before any imports that use it)
const logMock = mock(() => {});
mock.module('../../utils/logger', () => ({
  log: logMock,
}));

// Mock the checker module
const getCachedVersionMock = mock(() => '1.0.0');
const getLocalDevVersionMock = mock(() => null);
const findPluginEntryMock = mock(() => null);
const extractChannelMock = mock(() => 'latest');
const getLatestVersionMock = mock(() => Promise.resolve(null));
const updatePinnedVersionMock = mock(() => false);

mock.module('./checker', () => ({
  getCachedVersion: getCachedVersionMock,
  getLocalDevVersion: getLocalDevVersionMock,
  findPluginEntry: findPluginEntryMock,
  extractChannel: extractChannelMock,
  getLatestVersion: getLatestVersionMock,
  updatePinnedVersion: updatePinnedVersionMock,
}));

// Mock the cache module
mock.module('./cache', () => ({
  invalidatePackage: mock(() => false),
}));

// Mock the constants
mock.module('./constants', () => ({
  PACKAGE_NAME: 'oh-my-opencode-slim',
}));

// Import AFTER mocks are set up
import { createAutoUpdateCheckerHook } from './index';

describe('createAutoUpdateCheckerHook', () => {
  let mockCtx: PluginInput;
  let mockShowToast: ReturnType<typeof mock>;

  beforeEach(() => {
    mockShowToast = mock(() => Promise.resolve());
    mockCtx = {
      directory: '/test',
      client: {
        tui: {
          showToast: mockShowToast,
        },
      },
    } as unknown as PluginInput;

    // Reset mocks
    getCachedVersionMock.mockReturnValue('1.0.0');
    getLocalDevVersionMock.mockReturnValue(null);
    findPluginEntryMock.mockReturnValue(null);
    logMock.mockClear();
  });

  afterEach(() => {
    mockShowToast.mockClear();
  });

  test('should return early for non-session.created events', () => {
    const hook = createAutoUpdateCheckerHook(mockCtx, {
      showStartupToast: false,
    });

    hook.event({ event: { type: 'other.event' } });

    // Should not trigger hasChecked
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test('should return early if parentID exists (child session)', () => {
    const hook = createAutoUpdateCheckerHook(mockCtx, {
      showStartupToast: false,
    });

    hook.event({
      event: {
        type: 'session.created',
        properties: { info: { parentID: 'parent-123' } },
      },
    });

    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test('should only check once per hook instance', async () => {
    const hook = createAutoUpdateCheckerHook(mockCtx, {
      showStartupToast: true,
    });

    // Trigger twice
    hook.event({ event: { type: 'session.created' } });
    hook.event({ event: { type: 'session.created' } });

    // Wait for setTimeout
    await new Promise((r) => setTimeout(r, 50));

    // Should only show toast once
    expect(mockShowToast).toHaveBeenCalledTimes(1);
  });

  test('should handle errors gracefully without unhandled rejection', async () => {
    // Create a mock that throws
    let unhandledRejectionCaught = false;
    const rejectionHandler = () => {
      unhandledRejectionCaught = true;
    };
    process.on('unhandledRejection', rejectionHandler);

    // Make getCachedVersion throw
    getCachedVersionMock.mockImplementation(() => {
      throw new Error('Test error in getCachedVersion');
    });

    const hook = createAutoUpdateCheckerHook(mockCtx, {
      showStartupToast: false,
    });

    // Trigger the event
    hook.event({ event: { type: 'session.created' } });

    // Wait for setTimeout to execute
    await new Promise((r) => setTimeout(r, 100));

    // Should not have unhandled rejection
    expect(unhandledRejectionCaught).toBe(false);

    // Error should be logged
    expect(logMock).toHaveBeenCalled();

    process.off('unhandledRejection', rejectionHandler);

    // Reset mock
    getCachedVersionMock.mockReturnValue('1.0.0');
  });

  test('should show startup toast when enabled', async () => {
    const hook = createAutoUpdateCheckerHook(mockCtx, {
      showStartupToast: true,
      autoUpdate: false,
    });

    hook.event({ event: { type: 'session.created' } });

    // Wait for setTimeout
    await new Promise((r) => setTimeout(r, 50));

    expect(mockShowToast).toHaveBeenCalled();
    const callArgs = mockShowToast.mock.calls[0][0];
    expect(callArgs.body.title).toContain('OMO-Slim');
  });

  test('should not show startup toast when disabled', async () => {
    const hook = createAutoUpdateCheckerHook(mockCtx, {
      showStartupToast: false,
      autoUpdate: false,
    });

    hook.event({ event: { type: 'session.created' } });

    // Wait for setTimeout
    await new Promise((r) => setTimeout(r, 50));

    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test('should show dev mode toast when local dev version detected', async () => {
    getLocalDevVersionMock.mockReturnValue('1.2.3-dev');

    const hook = createAutoUpdateCheckerHook(mockCtx, {
      showStartupToast: true,
    });

    hook.event({ event: { type: 'session.created' } });

    // Wait for setTimeout
    await new Promise((r) => setTimeout(r, 50));

    expect(mockShowToast).toHaveBeenCalled();
    const callArgs = mockShowToast.mock.calls[0][0];
    expect(callArgs.body.title).toContain('(dev)');

    // Reset
    getLocalDevVersionMock.mockReturnValue(null);
  });
});
