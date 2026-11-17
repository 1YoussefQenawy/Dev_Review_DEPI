import { analyzeCode, getAiStatus, resetAiModuleForTests } from '../index';

describe('no unnecessary API calls', () => {
  const realFetch = globalThis.fetch;
  let spy: jest.Mock;
  beforeEach(() => {
    spy = jest.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    resetAiModuleForTests();
    delete process.env.AI_PROVIDER;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('importing the module and reading status never touches the network', () => {
    getAiStatus();
    expect(spy).not.toHaveBeenCalled();
  });

  it('default analysis uses the mock provider and never calls fetch', async () => {
    const jestLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { meta } = await analyzeCode({ code: 'const a = 1;', language: 'js' });
    jestLog.mockRestore();
    expect(meta.provider).toBe('mock');
    expect(spy).not.toHaveBeenCalled();
    expect(getAiStatus().usage.geminiRequests).toBe(0);
  });
});
