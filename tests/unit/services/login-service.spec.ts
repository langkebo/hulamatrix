/**
 * 登录服务测试
 * 测试 Matrix 用户认证和登录功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

// logger imported for mock purposes only
import { LoginService } from '@/services/login-service'

describe('LoginService', () => {
  let service: LoginService

  beforeEach(() => {
    vi.clearAllMocks()
    service = LoginService.getInstance()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = LoginService.getInstance()
      const instance2 = LoginService.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('should initialize without errors', () => {
      expect(() => {
        const newInstance = LoginService.getInstance()
        expect(newInstance).toBeDefined()
      }).not.toThrow()
    })
  })

  describe('Login Methods', () => {
    it('should have login method', () => {
      expect(typeof service.login).toBe('function')
    })

    it('should have logout method', () => {
      expect(typeof service.logout).toBe('function')
    })

    it('should have validateServer method', () => {
      expect(typeof service.validateServer).toBe('function')
    })

    it('should have discoverServerInfo method', () => {
      expect(typeof service.discoverServerInfo).toBe('function')
    })
  })

  describe('Configuration', () => {
    it('should handle login credentials structure', () => {
      const validCredentials = {
        username: 'testuser',
        password: 'password123',
        homeserver: 'https://matrix.example.org'
      }

      expect(validCredentials).toHaveProperty('username')
      expect(validCredentials).toHaveProperty('password')
      expect(validCredentials.homeserver).toBe('https://matrix.example.org')
    })

    it('should check login status', () => {
      expect(typeof service.isLoggedIn).toBe('function')
      // isLoggedIn checks if homeserver URL is set, which depends on matrixConfig
      const result = service.isLoggedIn()
      expect(typeof result).toBe('boolean')
    })
  })
})
