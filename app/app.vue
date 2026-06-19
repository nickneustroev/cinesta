<script setup lang="ts">
const { t, locale, setLocale } = useI18n()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: computed(() => locale.value)
  }
})

const title = computed(() => `${t('nav.home')} - Cinesta`)
const description = 'Cinesta помогает загружать экспорт Letterboxd, обогащать фильмы данными из TMDB и смотреть аналитику по фильмам, режиссерам и оценкам.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})

function switchLocale(code: string) {
  setLocale(code as 'en' | 'ru')
}
</script>

<template>
  <UApp :toaster="{ position: 'top-right' }">
    <UHeader>
      <template #left>
        <div class="flex items-center gap-6">
          <NuxtLink
            to="/"
            class="text-2xl font-bold shrink-0"
          >
            Cinesta
          </NuxtLink>

          <UNavigationMenu
            :ui="{ linkLabel: 'text-base' }"
            :items="[
              { label: $t('nav.home'), to: '/' },
              { label: $t('nav.movies'), to: '/movies' },
              { label: $t('nav.directors'), to: '/directors' }
            ]"
          />
        </div>
      </template>

      <template #right>
        <USelect
          :items="[
            { label: 'English', value: 'en' },
            { label: 'Русский', value: 'ru' }
          ]"
          value-key="value"
          class="w-32"
          :model-value="locale"
          @update:model-value="switchLocale"
        />

        <UColorModeButton />

        <UButton
          to="https://github.com/nickneustroev/cinesta"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UHeader>

    <UMain class="bg-accented">
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          Built with Nuxt UI • © {{ new Date().getFullYear() }}
        </p>
      </template>

      <template #right>
        <UButton
          to="https://github.com/nickneustroev/cinesta"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UFooter>
  </UApp>
</template>
