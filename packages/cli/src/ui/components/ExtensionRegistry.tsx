/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Text } from 'ink';
import { useKeypress } from '../hooks/useKeypress.js';
import { TextInput } from './shared/TextInput.js';
import {
  ScrollableList,
  type ScrollableListRef,
} from './shared/ScrollableList.js';
import {
  ExtensionRegistryClient,
  type RegistryExtension,
} from '../../services/ExtensionRegistryClient.js';
import { useTextBuffer } from './shared/text-buffer.js';
import { theme } from '../semantic-colors.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { type ExtensionManager } from '../../config/extension-manager.js';
import { type GeminiCLIExtension } from '@google/gemini-cli-core';

interface ExtensionRegistryProps {
  client?: ExtensionRegistryClient;
  onExit?: () => void;
}

type ViewState = 'list' | 'details';

export function ExtensionRegistry({
  client: injectedClient,
  onExit,
}: ExtensionRegistryProps) {
  const config = useConfig();
  const extensionManager = config.getExtensionLoader() as ExtensionManager;
  const [client] = useState(
    () => injectedClient || new ExtensionRegistryClient(),
  );
  const [query, setQuery] = useState('');
  const [extensions, setExtensions] = useState<RegistryExtension[]>([]);
  const [installedExtensions, setInstalledExtensions] = useState<
    GeminiCLIExtension[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [view, setView] = useState<ViewState>('list');

  const listRef = useRef<ScrollableListRef<RegistryExtension>>(null);

  const { terminalWidth, terminalHeight, confirmUpdateExtensionRequests } =
    useUIState();

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
  }, []);

  const viewport = useMemo(
    () => ({ width: terminalWidth, height: terminalHeight }),
    [terminalWidth, terminalHeight],
  );

  const isValidPath = useCallback(() => false, []);

  const buffer = useTextBuffer({
    viewport,
    isValidPath,
    onChange: handleQueryChange,
  });

  const loadExtensions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await client.getExtensions(1, 100); // Fetch more for scrolling
      setExtensions(result.extensions);
    } catch (error) {
      console.error('Failed to load extensions:', error);
    } finally {
      setLoading(false);
    }
  }, [client]);

  const searchExtensions = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const results = await client.searchExtensions(q);
        setExtensions(results);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Failed to search extensions:', error);
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const refreshInstalled = useCallback(() => {
    try {
      setInstalledExtensions(extensionManager.getExtensions());
    } catch (_e) {
      // Extensions might not be loaded yet
      setInstalledExtensions([]);
    }
  }, [extensionManager]);

  const handleInstall = useCallback(
    async (ext: RegistryExtension) => {
      setActionLoading(true);
      try {
        await extensionManager.installOrUpdateExtension({
          source: ext.url,
          type: 'git',
          autoUpdate: true,
        });
        refreshInstalled();
      } catch (error) {
        console.error('Failed to install extension:', error);
      } finally {
        setActionLoading(false);
      }
    },
    [extensionManager, refreshInstalled],
  );

  const handleUninstall = useCallback(
    async (ext: RegistryExtension) => {
      setActionLoading(true);
      try {
        await extensionManager.uninstallExtension(ext.extensionName, false);
        refreshInstalled();
      } catch (error) {
        console.error('Failed to uninstall extension:', error);
      } finally {
        setActionLoading(false);
      }
    },
    [extensionManager, refreshInstalled],
  );

  useEffect(() => {
    void loadExtensions();
    refreshInstalled();
    return () => {
      setExtensions([]);
      setLoading(true);
    };
  }, [loadExtensions, refreshInstalled]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query) {
        void searchExtensions(query);
      } else {
        void loadExtensions();
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query, loadExtensions, searchExtensions]);

  const isInstalled = useCallback(
    (ext: RegistryExtension) =>
      installedExtensions.some(
        (installed) =>
          installed.name === ext.extensionName ||
          installed.installMetadata?.source === ext.url,
      ),
    [installedExtensions],
  );

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        if (view === 'details') {
          setView('list');
          return;
        }
        if (onExit) {
          onExit();
          return;
        }
      }

      if (view === 'details') {
        const item = extensions[selectedIndex];
        if (!item || actionLoading) return;

        if (key.name === 'i' && !isInstalled(item)) {
          void handleInstall(item);
        } else if (key.name === 'u' && isInstalled(item)) {
          void handleUninstall(item);
        }
        return; // Consume other keys in details view
      }

      // Always route up/down to list navigation
      if (key.name === 'up') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.name === 'down') {
        setSelectedIndex((prev) => Math.min(extensions.length - 1, prev + 1));
        return;
      }

      if (key.name === 'return') {
        if (extensions[selectedIndex]) {
          setView('details');
        }
      }
    },
    { isActive: (confirmUpdateExtensionRequests?.length ?? 0) === 0 },
  );

  const renderItem = useCallback(
    ({ item, index }: { item: RegistryExtension; index: number }) => {
      const isSelected = index === selectedIndex;
      const installed = isInstalled(item);
      return (
        <Box key={item.id} flexDirection="row" paddingX={1} paddingBottom={1}>
          <Box width={2}>
            {isSelected ? (
              <Text color={theme.text.accent} bold>
                ┃
              </Text>
            ) : (
              <Text> </Text>
            )}
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            <Box>
              <Text
                bold
                color={isSelected ? theme.text.accent : theme.text.primary}
              >
                {item.extensionName}
              </Text>
              <Text color={theme.text.secondary}>
                {' '}
                v{item.extensionVersion}
              </Text>
              {installed && (
                <Text color={theme.status.success}> [Installed]</Text>
              )}
            </Box>
            <Box>
              <Text color={theme.text.secondary} wrap="truncate-end">
                {item.extensionDescription}
              </Text>
            </Box>
            <Box marginTop={0}>
              <Text color={theme.ui.comment}>
                ⭐ {item.stars} • {item.fullName}
              </Text>
            </Box>
          </Box>
        </Box>
      );
    },
    [selectedIndex, isInstalled],
  );

  const hasDialog = confirmUpdateExtensionRequests.length > 0;
  const selectedItem = extensions[selectedIndex];

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.focused}
      flexDirection="column"
      paddingX={1}
      width="100%"
      height="100%"
      overflow="hidden"
    >
      {view === 'list' ? (
        <>
          {/* Header */}
          <Box paddingX={1} flexShrink={0}>
            <Text bold color={theme.text.accent}>
              Extension Registry
            </Text>
          </Box>

          {/* Main content area */}
          <Box
            flexGrow={1}
            flexShrink={1}
            flexDirection="column"
            overflow="hidden"
          >
            {loading ? (
              <Box paddingX={2} paddingY={1}>
                <Text color={theme.text.secondary}>Loading extensions...</Text>
              </Box>
            ) : extensions.length === 0 ? (
              <Box paddingX={2} paddingY={1}>
                <Text color={theme.text.secondary}>No extensions found.</Text>
              </Box>
            ) : (
              <ScrollableList
                ref={listRef}
                data={extensions}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                estimatedItemHeight={() => 4}
                initialScrollIndex={selectedIndex}
                hasFocus={true}
              />
            )}
          </Box>

          {/* Search bar and action buttons */}
          <Box
            borderStyle="round"
            borderColor={theme.text.accent}
            paddingX={1}
            flexDirection="row"
            flexShrink={0}
          >
            <Box marginRight={1}>
              <Text color={theme.text.accent}>🔍</Text>
            </Box>
            <TextInput
              buffer={buffer}
              placeholder="Search extensions..."
              focus={!hasDialog}
            />
          </Box>
        </>
      ) : selectedItem ? (
        <>
          <Box paddingX={1} flexShrink={0}>
            <Text bold color={theme.text.accent}>
              Extension Details
            </Text>
          </Box>
          <Box
            flexDirection="column"
            paddingX={2}
            flexGrow={1}
            flexShrink={1}
            overflow="hidden"
          >
            {hasDialog ? (
              <Box flexGrow={1} />
            ) : (
              <>
                <Box marginBottom={1} flexShrink={0}>
                  <Text bold>{selectedItem.extensionName}</Text>
                  <Text color={theme.text.secondary}>
                    {' '}
                    v{selectedItem.extensionVersion}
                  </Text>
                </Box>

                <Box flexDirection="column" marginBottom={1} flexShrink={0}>
                  <Box>
                    <Box width={10}>
                      <Text color={theme.ui.comment}>Author</Text>
                    </Box>
                    <Text color={theme.ui.comment}>:</Text>
                    <Box marginLeft={1}>
                      <Text>{selectedItem.fullName}</Text>
                    </Box>
                  </Box>
                  <Box>
                    <Box width={10}>
                      <Text color={theme.ui.comment}>Stars</Text>
                    </Box>
                    <Text color={theme.ui.comment}>:</Text>
                    <Box marginLeft={1}>
                      <Text>⭐ {selectedItem.stars}</Text>
                    </Box>
                  </Box>
                  <Box>
                    <Box width={10}>
                      <Text color={theme.ui.comment}>Status</Text>
                    </Box>
                    <Text color={theme.ui.comment}>:</Text>
                    <Box marginLeft={1}>
                      {isInstalled(selectedItem) ? (
                        <Text color={theme.status.success}>Installed</Text>
                      ) : (
                        <Text color={theme.text.secondary}>Not Installed</Text>
                      )}
                    </Box>
                  </Box>
                </Box>

                {selectedItem.extensionDescription ? (
                  <Box
                    paddingX={2}
                    marginBottom={1}
                    flexShrink={1}
                    overflow="hidden"
                  >
                    <Text italic color={theme.text.secondary}>
                      {selectedItem.extensionDescription.trim()}
                    </Text>
                  </Box>
                ) : (
                  <Box paddingX={2} marginBottom={1} flexShrink={0}>
                    <Text color={theme.ui.comment} italic>
                      No description provided.
                    </Text>
                  </Box>
                )}

                <Box flexGrow={1} />

                <Box flexShrink={0}>
                  {actionLoading ? (
                    <Text color={theme.text.accent}>Processing...</Text>
                  ) : isInstalled(selectedItem) ? (
                    <Box>
                      <Text color={theme.status.error} bold>
                        [U]
                      </Text>
                      <Text> Uninstall</Text>
                    </Box>
                  ) : (
                    <Box>
                      <Text color={theme.text.accent} bold>
                        [I]
                      </Text>
                      <Text> Install</Text>
                    </Box>
                  )}
                </Box>
              </>
            )}
          </Box>
          <Box marginTop={0} paddingX={1} flexShrink={0}>
            <Text color={theme.ui.comment}>(Press Escape to go back)</Text>
          </Box>
        </>
      ) : null}
    </Box>
  );
}
