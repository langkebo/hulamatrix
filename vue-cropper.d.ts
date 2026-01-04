declare module 'vue-cropper' {
  import type { DefineComponent } from 'vue'

  export interface CropperOptions {
    img?: string | ArrayBuffer
    outputSize?: number
    outputType?: string
    info?: boolean
    canScale?: boolean
    autoCrop?: boolean
    autoCropWidth?: number
    autoCropHeight?: number
    fixed?: boolean
    fixedNumber?: [number, number]
    centerBox?: boolean
    high?: boolean
    infoTrue?: boolean
    maxImgSize?: number
    enlarge?: number
    mode?: string
    preView?: string | ArrayBuffer
    [key: string]: unknown
  }

  export const VueCropper: DefineComponent<CropperOptions>
  export default VueCropper
}

declare module 'vue-cropper/next/lib/vue-cropper.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
