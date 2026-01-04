// Type declarations for vue-virtual-scroller
declare module 'vue-virtual-scroller' {
  import { DefineComponent } from 'vue'

  export const DynamicScroller: DefineComponent<
    {
      items: readonly unknown[]
      minItemSize?: number
      buffer?: number
      keyField?: string
      typeField?: string
      direction?: 'vertical' | 'horizontal'
    },
    unknown,
    unknown
  >

  export const DynamicScrollerItem: DefineComponent<{
    item: unknown
    index: number
    active: boolean
    sizeDependencies?: unknown[]
    watchData?: boolean
    tag?: string
    emitUpdate?: boolean
  }>

  export const RecycleScroller: DefineComponent<{
    items: readonly unknown[]
    itemSize: number
    buffer?: number
    keyField?: string
    direction?: 'vertical' | 'horizontal'
  }>

  export const IdState: DefineComponent<unknown, unknown, unknown>
}

declare module 'vue-virtual-scroller/dist/vue-virtual-scroller.css' {
  const css: string
  export default css
}
