import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { MiniMaxAgent } from '../agents/minimax.js';
import {
  getMiniMaxConfigPath,
  MINIMAX_API_ENDPOINTS,
  normalizeMiniMaxApiBase,
  prepareMiniMaxConfig,
  writeMiniMaxMcpConfig,
} from '../agents/minimax-config.js';

describe('MiniMax configuration', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'rover-minimax-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('normalizes each documented regional endpoint to its API root', () => {
    expect(
      normalizeMiniMaxApiBase(MINIMAX_API_ENDPOINTS.global_en.openai)
    ).toBe('https://api.minimax.io');
    expect(
      normalizeMiniMaxApiBase(MINIMAX_API_ENDPOINTS.global_en.anthropic)
    ).toBe('https://api.minimax.io');
    expect(normalizeMiniMaxApiBase(MINIMAX_API_ENDPOINTS.cn_zh.openai)).toBe(
      'https://api.minimaxi.com'
    );
    expect(normalizeMiniMaxApiBase(MINIMAX_API_ENDPOINTS.cn_zh.anthropic)).toBe(
      'https://api.minimaxi.com'
    );
  });

  it('applies the selected model without changing the configured region', () => {
    const configPath = getMiniMaxConfigPath(testDir);
    mkdirSync(join(testDir, '.mini-agent', 'config'), { recursive: true });
    writeFileSync(
      configPath,
      [
        'api_key: test-key',
        `api_base: ${MINIMAX_API_ENDPOINTS.cn_zh.anthropic}`,
        'provider: anthropic',
        'model: MiniMax-M3',
      ].join('\n')
    );

    prepareMiniMaxConfig('MiniMax-M2.7', configPath);

    const config = parse(readFileSync(configPath, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(config.api_base).toBe('https://api.minimaxi.com');
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('MiniMax-M2.7');
  });

  it('writes stdio and remote MCP entries in Mini-Agent format', () => {
    const configPath = join(testDir, 'mcp.json');

    writeMiniMaxMcpConfig(
      configPath,
      'workspace-tools',
      'tool-server --stdio',
      'stdio',
      ['WORKSPACE=/workspace'],
      []
    );
    writeMiniMaxMcpConfig(
      configPath,
      'remote-tools',
      'https://example.test/mcp',
      'http',
      [],
      ['Authorization: Bearer']
    );

    const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(config.mcpServers['workspace-tools']).toMatchObject({
      command: 'tool-server',
      args: ['--stdio'],
      env: { WORKSPACE: '/workspace' },
    });
    expect(config.mcpServers['remote-tools']).toMatchObject({
      type: 'http',
      url: 'https://example.test/mcp',
      headers: { Authorization: 'Bearer' },
    });
  });

  it('uses the Mini-Agent ACP command and official install source', () => {
    const agent = new MiniMaxAgent('latest', 'MiniMax-M2.7');
    expect(agent.binary).toBe('mini-agent');
    expect(agent.acpCommand).toBe('mini-agent-acp');
    expect(agent.getInstallCommand()).toContain(
      'git+https://github.com/MiniMax-AI/Mini-Agent.git'
    );
  });
});
