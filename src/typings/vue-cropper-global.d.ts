// 全局 vue-cropper 类型声明
declare module 'vue-cropper' {
  import { DefineComponent } from 'vue'

  interface VueCropperData {
    url: string
    img: HTMLImageElement | null
    x1: number
    x2: number
    y1: number
    y2: number
  }

  interface VueCropperInstance {
    startCrop(): void
    stopCrop(): void
    clearCrop(): void
    rotateLeft(): void
    rotateRight(): void
    reload(): void
    getCropData(callback: (data: VueCropperData) => void): void
    getCropAxis(callback: (data: { x1: number; x2: number; y1: number; y2: number }) => void): void
    goAutoCrop(): void
    getImgAxis(callback: (data: { x1: number; y1: number; x2: number; y2: number }) => void): void
    getCanvasData(callback: (data: { width: number; height: number }) => void): void
    getImageData(callback: (data: { width: number; height: number; left: number; top: number }) => void): void
    getTData(): { width: number; height: number; left: number; top: number }
    getScale(): number
    setCropPercent(percent: number[]): void
    setCropW(val: number): void
    setCropH(val: number): void
    setScale(val: number): void
    setRotate(val: number): void
    loading(show: boolean): void
    showMessage(msg: string): void
    onCropStart(callback: () => void): void
    onCropMoving(callback: () => void): void
    onCropEnd(callback: () => void): void
    onCropPicture(callback: (data: VueCropperData) => void): void
    onRealTime(callback: (data: VueCropperData) => void): void
  }

  interface VueCropperOptions {
    img?: string
    outputSize?: number
    outputType?: string
    info?: boolean
    full?: boolean
    canMove?: boolean
    canMoveBox?: boolean
    original?: boolean
    autoCrop?: boolean
    autoCropWidth?: number
    autoCropHeight?: number
    fixedBox?: boolean
    fixed?: boolean
    fixedNumber?: [number, number]
    centerBox?: boolean
    infoTrue?: boolean
    maxImgSize?: number
    enlarge?: number
    mode?: string
    realTime?: boolean
  }

  const VueCropper: DefineComponent<VueCropperOptions> & {
    new (): VueCropperInstance
  }

  export default VueCropper
}

// 导出以供其他模块使用
export type { VueCropperOptions, VueCropperInstance, VueCropperData }