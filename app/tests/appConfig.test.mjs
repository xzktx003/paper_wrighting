import { describe, it, expect } from 'vitest';
import { loadAppConfig, saveAppConfig } from '../apps/backend/src/config/appConfig.js';

describe('App Config', () => {
  it('loadAppConfig returns config with required fields', async () => {
    const config = await loadAppConfig();
    expect(config).toHaveProperty('claude_api_key');
    expect(config).toHaveProperty('claude_model');
    expect(config).toHaveProperty('claude_base_url');
    expect(config).toHaveProperty('claude_ca_cert');
    expect(config).toHaveProperty('projects_dir');
  });

  it('config has correct base URL for local proxy', async () => {
    const config = await loadAppConfig();
    expect(config.claude_base_url).toBe('https://10.40.0.2');
  });

  it('config has correct CA cert path', async () => {
    const config = await loadAppConfig();
    expect(config.claude_ca_cert).toContain('caddy-root.crt');
  });

  it('config model is a valid Claude model', async () => {
    const config = await loadAppConfig();
    expect(config.claude_model).toMatch(/claude/);
  });
});
