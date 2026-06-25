import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'

export function useTabsOrientation() {
  const breakpoints = useBreakpoints(breakpointsTailwind)
  const isMobile = breakpoints.smaller('sm')

  return computed(() => isMobile.value ? 'vertical' : 'horizontal')
}
