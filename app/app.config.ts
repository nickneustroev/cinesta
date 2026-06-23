export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      secondary: 'slate',
      neutral: 'slate'
    },
    header: {
      slots: {
        root: 'bg-default border-b border-default h-(--ui-header-height) sticky top-0 z-50'
      }
    },
    pageSection: {
      slots: {
        container: 'flex flex-col lg:grid py-16 sm:py-16 lg:py-16 gap-8 sm:gap-12',
        title: 'text-default font-semibold',
        description: 'sm:text-xl'
      }
    },
    pageFeature: {
      slots: {
        title: 'text-lg lg:text-xl font-semibold',
        description: 'text-base lg:text-lg'
      }
    },
    pageCard: {
      slots: {
        title: 'text-xl text-default font-semibold',
        description: 'mt-1 text-muted text-base'
      }
    },
    card: {
      slots: {
        root: 'rounded-lg overflow-hidden shadow-md',
        header: 'p-4 sm:px-4',
        title: 'text-xl text-default font-semibold',
        description: 'mt-1 text-muted text-base',
        body: 'p-4 sm:p-4',
        footer: 'p-4 sm:px-4'
      }
    },
    tabs: {
      slots: {
        trigger: 'cursor-pointer'
      }
    },
    user: {
      variants: {
        to: {
          false: {
            name: 'text-toned',
            description: ''
          }
        }
      }
    },
    button: {
      slots: {
        base: 'rounded-full cursor-pointer'
      },
      variants: {
        size: {
          xxl: {
            base: 'px-5 py-2 text-lg gap-2.5',
            leadingIcon: 'size-7',
            leadingAvatarSize: 'sm',
            trailingIcon: 'size-7'
          },
          xxxl: {
            base: 'px-6.5 py-4 text-xl gap-2.5',
            leadingIcon: 'size-8',
            leadingAvatarSize: 'sm',
            trailingIcon: 'size-8'
          }
        }
      },
      compoundVariants: [
        {
          size: 'xxl',
          square: true,
          class: 'p-2.5'
        },
        {
          size: 'xxxl',
          square: true,
          class: 'p-2.5'
        },
        {
          color: 'primary',
          variant: 'solid',
          class: 'text-inverted bg-primary hover:bg-primary-600 active:bg-primary-600 disabled:bg-primary aria-disabled:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
        },
        {
          color: 'primary',
          variant: 'outline',
          class: 'ring ring-inset ring-primary/50 text-primary hover:bg-primary/10 active:bg-primary/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        },
        {
          color: 'primary',
          variant: 'soft',
          class: 'text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/15 focus:outline-none focus-visible:bg-primary/15 disabled:bg-primary/10 aria-disabled:bg-primary/10'
        },
        {
          color: 'primary',
          variant: 'subtle',
          class: 'text-primary ring ring-inset ring-primary/25 bg-primary/10 hover:bg-primary/15 active:bg-primary/15 disabled:bg-primary/10 aria-disabled:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        },
        {
          color: 'primary',
          variant: 'ghost',
          class: 'text-primary hover:bg-primary/10 active:bg-primary/10 focus:outline-none focus-visible:bg-primary/10 disabled:bg-transparent aria-disabled:bg-transparent dark:disabled:bg-transparent dark:aria-disabled:bg-transparent'
        },
        {
          color: 'primary',
          variant: 'link',
          class: 'text-primary hover:text-primary/75 active:text-primary/75 disabled:text-primary aria-disabled:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
        }
      ]
    }
  }
})
