import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import YAML from 'yaml';

const CONFIG_DIR = join(process.env.HOME, '.paper-writer');
const CONFIG_PATH = join(CONFIG_DIR, 'config.yaml');

const DEFAULT_CONFIG = {
  llm_provider: 'openai-compatible',
  llm_api_key: 'sk-w3qQcXRt3V3xCSK80SaSBI2OYMSBJrE0vIEIrAlLuTQAZnSo',
  llm_base_url: 'https://10.40.0.2',
  llm_ca_cert: join(process.env.HOME, '.claude-code', 'caddy-root.crt'),
  llm_model: 'gpt-5.5',
  claude_api_key: 'sk-w3qQcXRt3V3xCSK80SaSBI2OYMSBJrE0vIEIrAlLuTQAZnSo',
  claude_base_url: 'https://10.40.0.2',
  claude_ca_cert: join(process.env.HOME, '.claude-code', 'caddy-root.crt'),
  claude_model: 'claude-sonnet-4.6',
  default_template: 'plain',
  editor_mode: 'markdown',
  projects_dir: join(process.env.HOME, 'papers'),
};

export async function loadAppConfig() {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...YAML.parse(content) };
  } catch (e) {
    if (e.code === 'ENOENT') {
      await mkdir(CONFIG_DIR, { recursive: true });
      await writeFile(CONFIG_PATH, YAML.stringify(DEFAULT_CONFIG), 'utf-8');
      return DEFAULT_CONFIG;
    }
    throw e;
  }
}

export async function saveAppConfig(config) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, YAML.stringify(config), 'utf-8');
}
