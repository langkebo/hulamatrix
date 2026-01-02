import { adapterFactory } from '@/adapters/adapter-factory'
import type { EncryptedFile } from '@/integrations/matrix/mediaCrypto'

/** 上传文件响应接口 */
interface UploadFileResponse {
  url: string
  name: string
  size: number
  type: string
}

/** 下载文件响应接口 */
interface DownloadFileResponse {
  blob: Blob
  url: string
}

export class FileService {
  async uploadWithBackup(
    file: File | Blob,
    roomId?: string,
    onProgress?: (p: number) => void
  ): Promise<{ primary: UploadFileResponse; backup?: UploadFileResponse }> {
    const matrix = adapterFactory.createFileAdapter()
    const uploadParams: { file: File | Blob; roomId?: string; onProgress?: (progress: number) => void } = { file }
    if (roomId) uploadParams.roomId = roomId
    if (onProgress) uploadParams.onProgress = onProgress

    const primary = (await matrix.uploadFile(uploadParams)) as UploadFileResponse
    let backup: UploadFileResponse | undefined
    try {
      const ws = adapterFactory.createFileAdapter()
      backup = (await ws.uploadFile(uploadParams)) as UploadFileResponse
    } catch {
      backup = undefined
    }
    return { primary, backup }
  }

  async downloadWithResume(
    fileIdOrUrl: string,
    savePath?: string,
    resumeFrom?: number,
    onProgress?: (p: number) => void
  ): Promise<DownloadFileResponse> {
    if (/^https?:\/\//.test(fileIdOrUrl)) {
      const headers: Record<string, string> = {}
      if (resumeFrom && resumeFrom > 0) headers['Range'] = `bytes=${resumeFrom}-`
      const res = await fetch(fileIdOrUrl, { headers })
      const blob = await res.blob()
      return { blob, url: fileIdOrUrl }
    }
    const matrix = adapterFactory.createFileAdapter()
    const downloadParams: {
      fileId: string
      savePath?: string
      onProgress?: (progress: number) => void
      resumeFrom?: number
    } = { fileId: fileIdOrUrl }
    if (savePath) downloadParams.savePath = savePath
    if (onProgress) downloadParams.onProgress = onProgress
    if (resumeFrom !== undefined) downloadParams.resumeFrom = resumeFrom
    return matrix.downloadFile(downloadParams) as Promise<DownloadFileResponse>
  }

  async downloadWithResumeAndDecrypt(
    fileIdOrUrl: string,
    encrypted?: EncryptedFile,
    resumeFrom?: number,
    onProgress?: (p: number) => void
  ): Promise<{ data: Uint8Array; url: string }> {
    const res = await this.downloadWithResume(fileIdOrUrl, undefined, resumeFrom, onProgress)
    const blob = res.blob as Blob
    const buffer = await blob.arrayBuffer()
    const data = new Uint8Array(buffer)
    if (!encrypted) return { data, url: res.url }
    const { decryptEncryptedFile, sha256 } = await import('@/integrations/matrix/mediaCrypto')
    const plain = await decryptEncryptedFile(data, encrypted)
    if (encrypted.hashes?.sha256) {
      const sum = await sha256(plain)
      if (sum !== encrypted.hashes.sha256) throw new Error('sha256 mismatch')
    }
    return { data: new Uint8Array(plain), url: res.url }
  }
}

export const fileService = new FileService()
