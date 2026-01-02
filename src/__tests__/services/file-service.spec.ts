import { describe, it, expect, vi } from 'vitest'

vi.mock('@/adapters/adapter-factory', () => {
  const fileAdapter = {
    uploadFile: vi.fn(async ({ file }) => ({ url: 'matrix://mxc/' + (file as any).name })),
    downloadFile: vi.fn(async ({ fileId }) => ({ blob: new Blob(['x']), url: 'http://' + fileId }))
  }
  return { adapterFactory: { createFileAdapter: () => fileAdapter } }
})

import { fileService } from '@/services/file-service'

describe('file-service', () => {
  it('uploads with backup and returns primary url', async () => {
    const blob = new Blob(['data'], { type: 'text/plain' })
    ;(blob as any).name = 't.txt'
    const res = await fileService.uploadWithBackup(blob)
    expect(res.primary.url).toContain('matrix://mxc/')
  })
  it('downloads with resume', async () => {
    const res = await fileService.downloadWithResume('fileId', undefined, 100)
    expect(res.blob).toBeDefined()
  })
})
