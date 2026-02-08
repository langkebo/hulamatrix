export class SynapseEnhancedError extends Error {
  code: string
  data?: Record<string, unknown>

  constructor(message: string, code: string = 'UNKNOWN', data?: Record<string, unknown>) {
    super(message)
    this.name = 'SynapseEnhancedError'
    this.code = code
    this.data = data

    Object.setPrototypeOf(this, SynapseEnhancedError.prototype)
  }
}

export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  RATE_LIMITED = 'RATE_LIMITED',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_PARAMS = 'INVALID_PARAMS',
  SERVER_ERROR = 'SERVER_ERROR'
}
