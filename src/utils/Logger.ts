type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogOptions {
  level?: LogLevel
  prefix?: string
}

const getTimestamp = (): string => {
  return new Date().toISOString()
}

const formatMessage = (message: unknown[], prefix?: string): string[] => {
  const timestamp = getTimestamp()
  const prefixStr = prefix ? `[${prefix}]` : ''
  return message.map((msg) =>
    typeof msg === 'string' ? `${timestamp} ${prefixStr} ${msg}` : `${timestamp} ${prefixStr} ${JSON.stringify(msg)}`
  )
}

const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.debug(...formatMessage(args))
    }
  },

  info: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.info(...formatMessage(args))
    }
  },

  warn: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.warn(...formatMessage(args))
    }
  },

  error: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.error(...formatMessage(args))
    }
  },

  group: (label: string, fn: () => void) => {
    if (import.meta.env.DEV) {
      console.group(label)
      fn()
      console.groupEnd()
    }
  },

  time: (label: string) => {
    if (import.meta.env.DEV) {
      console.time(label)
    }
  },

  timeEnd: (label: string) => {
    if (import.meta.env.DEV) {
      console.timeEnd(label)
    }
  }
}

export const createServiceLogger = (serviceName: string) => {
  return {
    debug: (...args: unknown[]) => logger.debug(args, serviceName),
    info: (...args: unknown[]) => logger.info(args, serviceName),
    warn: (...args: unknown[]) => logger.warn(args, serviceName),
    error: (...args: unknown[]) => logger.error(args, serviceName),
    group: (label: string, fn: () => void) => logger.group(`${serviceName}: ${label}`, fn),
    time: (label: string) => logger.time(`${serviceName}: ${label}`),
    timeEnd: (label: string) => logger.timeEnd(`${serviceName}: ${label}`)
  }
}

export default logger
