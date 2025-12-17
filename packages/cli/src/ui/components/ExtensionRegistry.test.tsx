/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExtensionRegistry } from './ExtensionRegistry.js';
import { ExtensionRegistryClient } from '../../services/ExtensionRegistryClient.js';
import { ConfigContext } from '../contexts/ConfigContext.js';

// Mock ExtensionRegistryClient
vi.mock('../../services/ExtensionRegistryClient.js', () => {
  const ExtensionRegistryClient = vi.fn();
  ExtensionRegistryClient.prototype.getExtensions = vi
    .fn()
    .mockImplementation(async () => ({
      extensions: [
        {
          id: 'ext1',
          extensionName: 'Test Extension 1',
          extensionVersion: '1.0.0',
          extensionDescription: 'Description 1',
          stars: 10,
          fullName: 'test/ext1',
        },
      ],
      total: 1,
    }));
  ExtensionRegistryClient.prototype.searchExtensions = vi
    .fn()
    .mockResolvedValue([
      {
        id: 'ext1',
        extensionName: 'Test Extension 1',
        extensionVersion: '1.0.0',
        extensionDescription: 'Description 1',
        stars: 10,
        fullName: 'test/ext1',
      },
    ]);
  return { ExtensionRegistryClient };
});

// Mock useUIState
vi.mock('../contexts/UIStateContext.js', () => ({
  useUIState: () => ({
    terminalWidth: 80,
    terminalHeight: 24,
    confirmUpdateExtensionRequests: [],
  }),
}));

// Mock useConfig
const mockConfig = {
  getExtensionLoader: vi.fn().mockReturnValue({
    getExtensions: vi.fn().mockReturnValue([]),
    installOrUpdateExtension: vi.fn(),
    uninstallExtension: vi.fn(),
  }),
};

vi.mock('../contexts/ConfigContext.js', async (importOriginal) => {
  const actual = await (
    importOriginal as () => Promise<Record<string, unknown>>
  )();
  return {
    ...actual,
    useConfig: () => mockConfig,
  };
});

// Mock ScrollableList
vi.mock('./shared/ScrollableList.js', () => ({
  ScrollableList: ({
    data,
    renderItem,
  }: {
    data: unknown[];
    renderItem: (props: { item: unknown; index: number }) => React.ReactNode;
  }) => (
    <React.Fragment>
      {data.map((item, index) => renderItem({ item, index }))}
    </React.Fragment>
  ),
}));

// Mock useKeypressContext
vi.mock('../contexts/KeypressContext.js', () => ({
  useKeypressContext: () => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

// Mock useKeypress
vi.mock('../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));

describe('ExtensionRegistry', () => {
  let resolveExtensions:
    | ((value: { extensions: unknown[]; total: number }) => void)
    | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    ExtensionRegistryClient.prototype.getExtensions = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveExtensions = resolve;
          }),
      );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    let lastFrame: () => string | undefined = () => undefined;
    await React.act(async () => {
      const result = render(
        <ConfigContext.Provider
          value={
            mockConfig as unknown as React.ContextType<typeof ConfigContext>
          }
        >
          <ExtensionRegistry />
        </ConfigContext.Provider>,
      );
      lastFrame = result.lastFrame;
    });

    expect(lastFrame()).toContain('Loading extensions...');

    // Cleanup: resolve the promise to avoid act warnings after test
    await React.act(async () => {
      if (resolveExtensions) {
        resolveExtensions({ extensions: [], total: 0 });
      }
    });

    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('Loading...');
    });
  });

  it('renders extension list after loading', async () => {
    let lastFrame: () => string | undefined = () => undefined;
    await React.act(async () => {
      const result = render(
        <ConfigContext.Provider
          value={
            mockConfig as unknown as React.ContextType<typeof ConfigContext>
          }
        >
          <ExtensionRegistry />
        </ConfigContext.Provider>,
      );
      lastFrame = result.lastFrame;
    });

    expect(lastFrame()).toContain('Loading extensions...');

    await React.act(async () => {
      if (resolveExtensions) {
        resolveExtensions({
          extensions: [
            {
              id: 'ext1',
              extensionName: 'Test Extension 1',
              extensionVersion: '1.0.0',
              extensionDescription: 'Description 1',
              stars: 10,
              fullName: 'test/ext1',
            },
          ],
          total: 1,
        });
      }
    });

    // Wait for loading to finish
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('Loading...');
    });

    expect(lastFrame()).toContain('Test Extension 1');
    expect(lastFrame()).toContain('v1.0.0');
    expect(lastFrame()).toContain('Description 1');
  });
});
