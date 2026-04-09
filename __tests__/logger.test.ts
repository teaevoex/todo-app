import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '@/lib/logger'

describe('logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('info writes to stdout with INFO level', () => {
    logger.info('test message', 'ctx')
    expect(stdoutSpy).toHaveBeenCalledOnce()
    const output = stdoutSpy.mock.calls[0][0] as string
    expect(output).toContain('INFO')
    expect(output).toContain('[ctx]')
    expect(output).toContain('test message')
  })

  it('warn writes to stdout with WARN level', () => {
    logger.warn('warning msg')
    expect(stdoutSpy).toHaveBeenCalledOnce()
    const output = stdoutSpy.mock.calls[0][0] as string
    expect(output).toContain('WARN')
    expect(output).toContain('warning msg')
  })

  it('error writes to stderr with ERROR level', () => {
    logger.error('error msg', 'auth')
    expect(stderrSpy).toHaveBeenCalledOnce()
    const output = stderrSpy.mock.calls[0][0] as string
    expect(output).toContain('ERROR')
    expect(output).toContain('[auth]')
    expect(output).toContain('error msg')
  })

  it('includes details as JSON when provided', () => {
    logger.info('with details', undefined, { key: 'value' })
    const output = stdoutSpy.mock.calls[0][0] as string
    expect(output).toContain('{"key":"value"}')
  })

  it('includes ISO timestamp', () => {
    logger.info('timestamped')
    const output = stdoutSpy.mock.calls[0][0] as string
    expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T/)
  })

  it('suppresses output in test environment', () => {
    vi.stubEnv('NODE_ENV', 'test')
    logger.info('should not output')
    logger.warn('should not output')
    logger.error('should not output')
    expect(stdoutSpy).not.toHaveBeenCalled()
    expect(stderrSpy).not.toHaveBeenCalled()
  })
})
