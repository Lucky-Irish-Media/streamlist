export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, any>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

function getTimestamp(): string {
  return new Date().toISOString()
}

function createLogEntry(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: getTimestamp(),
    context,
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return entry
}

function logToConsole(entry: LogEntry): void {
  const logMessage = `[${entry.level.toUpperCase()}] ${entry.timestamp} - ${entry.message}`
  
  const data: any = { ...entry }
  delete data.level
  delete data.timestamp
  delete data.message

  switch (entry.level) {
    case 'debug':
      console.debug(logMessage, Object.keys(data).length > 0 ? data : '')
      break
    case 'info':
      console.info(logMessage, Object.keys(data).length > 0 ? data : '')
      break
    case 'warn':
      console.warn(logMessage, Object.keys(data).length > 0 ? data : '')
      break
    case 'error':
      console.error(logMessage, Object.keys(data).length > 0 ? data : '')
      break
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, any>) => {
    const entry = createLogEntry('debug', message, context)
    logToConsole(entry)
    return entry
  },

  info: (message: string, context?: Record<string, any>) => {
    const entry = createLogEntry('info', message, context)
    logToConsole(entry)
    return entry
  },

  warn: (message: string, context?: Record<string, any>) => {
    const entry = createLogEntry('warn', message, context)
    logToConsole(entry)
    return entry
  },

  error: (message: string, context?: Record<string, any>, error?: Error) => {
    const entry = createLogEntry('error', message, context, error)
    logToConsole(entry)
    return entry
  },
}