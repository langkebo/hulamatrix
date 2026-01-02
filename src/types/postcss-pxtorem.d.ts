declare module 'postcss-pxtorem' {
  import type { Plugin } from 'postcss'

  interface Options {
    rootValue?: number | ((input: { file: string }) => number)
    unitPrecision?: number
    propList?: string[]
    selectorBlackList?: string[]
    replace?: boolean
    mediaQuery?: boolean
    minPixelValue?: number
    exclude?: RegExp | string | ((file: string) => boolean)
    landscape?: boolean
    landscapeUnit?: string
    landscapeWidth?: number
  }

  export default function postcsspxtorem(options?: Options): Plugin
}
