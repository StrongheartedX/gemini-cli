/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createExtension } from '../test-utils/createExtension.js';
import { ExtensionManager } from './extension-manager.js';
import { themeManager } from '../ui/themes/theme-manager.js';
import { GEMINI_DIR } from '@google/gemini-cli-core';
import { type MergedSettings } from './settings.js';

vi.mock('../ui/themes/theme-manager.js', () => ({
  themeManager: {
    registerExtensionThemes: vi.fn(),
  },
}));

describe('ExtensionManager theme loading', () => {
  let extensionManager: ExtensionManager;
  let tempHomeDir: string;
  let userExtensionsDir: string;

  beforeEach(() => {
    tempHomeDir = fs.mkdtempSync(
      path.join(fs.realpathSync('/tmp'), 'gemini-cli-test-'),
    );
    process.env['GEMINI_USER_HOME'] = tempHomeDir;
    userExtensionsDir = path.join(tempHomeDir, GEMINI_DIR, 'extensions');
    fs.mkdirSync(userExtensionsDir, { recursive: true });

    extensionManager = new ExtensionManager({
      settings: {
        telemetry: { enabled: false },
        experimental: { extensionConfig: true },
        security: { blockGitExtensions: false },
        admin: { extensions: { enabled: true }, mcp: { enabled: true } },
        tools: { enableHooks: true },
        hooks: { enabled: true },
      } as MergedSettings,
      requestConsent: async () => true,
      requestSetting: async () => '',
      workspaceDir: '/workspace',
      enabledExtensionOverrides: [],
    });
    vi.clearAllMocks();
  });

  it('should register themes from an extension', async () => {
    createExtension({
      extensionsDir: userExtensionsDir,
      name: 'test-extension-with-themes',
      themes: [
        {
          name: 'My Test Theme',
          type: 'custom',
          text: {
            primary: '#ffffff',
          },
        },
      ],
    });

    await extensionManager.loadExtensions();

    expect(themeManager.registerExtensionThemes).toHaveBeenCalledWith([
      {
        name: 'My Test Theme',
        type: 'custom',
        text: {
          primary: '#ffffff',
        },
      },
    ]);
  });
});
