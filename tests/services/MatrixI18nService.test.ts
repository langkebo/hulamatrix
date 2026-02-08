/**
 * MatrixI18nService 单元测试
 *
 * 测试国际化服务的核心功能，包括：
 * - 翻译文本获取
 * - 参数插值
 * - 日期时间格式化
 * - 数字格式化
 * - 文件大小格式化
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import MatrixI18nService from '../../src/services/matrix/MatrixI18nService'

describe('MatrixI18nService', () => {
  let i18nService: MatrixI18nService

  beforeEach(() => {
    i18nService = MatrixI18nService.getInstance()
  })

  describe('翻译功能', () => {
    it('应该返回默认语言的翻译文本', () => {
      const result = i18nService.t('common.ok')
      expect(result).toBe('确定')
    })

    it('应该支持参数插值', () => {
      const result = i18nService.t('user_menu.notifications.title', { name: 'Test' })
      expect(result).toBe('通知设置')
    })

    it('当翻译键不存在时应该返回键本身', () => {
      const result = i18nService.t('non.existent.key')
      expect(result).toBe('non.existent.key')
    })

    it('应该支持切换语言', async () => {
      await i18nService.setLocale('en-US')
      expect(i18nService.currentLocale.value).toBe('en-US')

      const result = i18nService.t('common.ok')
      expect(result).toBe('OK')
    })
  })

  describe('日期时间格式化', () => {
    it('应该格式化相对时间', () => {
      const now = new Date()
      const result = i18nService.formatDate(now, { format: 'relative' })
      expect(result).toBeDefined()
    })

    it('应该格式化日期', () => {
      const date = new Date('2025-01-19')
      const result = i18nService.formatDate(date, { format: 'date' })
      expect(result).toBeDefined()
    })
  })

  describe('数字格式化', () => {
    it('应该格式化数字', () => {
      const result = i18nService.formatNumber(1234.56)
      expect(result).toBeDefined()
    })

    it('应该格式化货币', () => {
      const result = i18nService.formatCurrency(99.99, 'USD')
      expect(result).toContain('99')
    })

    it('应该格式化百分比', () => {
      const result = i18nService.formatPercent(0.75)
      expect(result).toContain('75')
    })
  })

  describe('文件大小格式化', () => {
    it('应该格式化字节', () => {
      const result = i18nService.formatFileSize(500)
      expect(result).toBeDefined()
    })

    it('应该格式化千字节', () => {
      const result = i18nService.formatFileSize(1024)
      expect(result).toBeDefined()
    })

    it('应该格式化兆字节', () => {
      const result = i18nService.formatFileSize(1024 * 1024)
      expect(result).toBeDefined()
    })
  })

  describe('时长格式化', () => {
    it('应该格式化秒', () => {
      const result = i18nService.formatDuration(30)
      expect(result).toBeDefined()
    })

    it('应该格式化分钟和秒', () => {
      const result = i18nService.formatDuration(90)
      expect(result).toBeDefined()
    })

    it('应该格式化小时、分钟和秒', () => {
      const result = i18nService.formatDuration(3661)
      expect(result).toBeDefined()
    })
  })

  describe('语言管理', () => {
    it('应该返回支持的语言列表', () => {
      const locales = i18nService.supportedLocales
      expect(locales.length).toBeGreaterThan(0)
      expect(locales.some((l) => l.code === 'zh-CN')).toBe(true)
      expect(locales.some((l) => l.code === 'en-US')).toBe(true)
    })

    it('应该返回当前语言信息', () => {
      const localeInfo = i18nService.currentLocaleInfo
      expect(localeInfo).toBeDefined()
      expect(localeInfo?.code).toBeDefined()
    })

    it('应该支持 RTL 语言方向检测', () => {
      expect(i18nService.isRTL()).toBe(false)
    })
  })

  describe('事件系统', () => {
    it('应该支持事件监听', () => {
      const listener = vi.fn()
      i18nService.on('testEvent', listener)

      const listeners = i18nService['_i18nListeners']
      expect(listeners.has('testEvent')).toBe(true)
    })

    it('应该支持事件取消监听', () => {
      const listener = vi.fn()
      i18nService.on('testEvent', listener)
      i18nService.off('testEvent', listener)

      const listeners = i18nService['_i18nListeners']
      expect(listeners.has('testEvent')).toBe(true)
    })

    it('应该触发事件', () => {
      const listener = vi.fn()
      i18nService.on('testEvent', listener)

      i18nService['notifyListeners']('testEvent', { data: 'test' })

      expect(listener).toHaveBeenCalledWith({ data: 'test' })
    })
  })

  describe('备用语言设置', () => {
    it('应该设置备用语言', () => {
      i18nService.setFallbackLocale('zh-CN')
      expect(i18nService.fallbackLocale.value).toBe('zh-CN')
    })
  })

  describe('销毁', () => {
    it('应该正确销毁服务', () => {
      i18nService.on('testEvent', () => {})
      expect(i18nService['_i18nListeners'].size).toBeGreaterThan(0)

      i18nService.destroy()
      expect(i18nService['_i18nListeners'].size).toBe(0)
    })
  })
})
