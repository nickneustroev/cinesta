# Cinesta

Cinesta - клиентское Nuxt-приложение для импорта и анализа экспорта Letterboxd. Оно принимает `.zip`-архив, нормализует историю просмотров, при необходимости догружает метаданные из TMDB и показывает аналитику по фильмам, режиссерам, оценкам и годам просмотров.

## Что умеет проект

- импортирует экспорт Letterboxd из `.zip`
- поддерживает демо-режим через `public/demo.zip`
- строит ленты фильмов, карточки режиссеров и набор графиков
- сохраняет последний импорт в `IndexedDB`
- поддерживает русский и английский интерфейс
- использует TMDB для жанров, постеров, режиссеров и дополнительных названий

## Актуальный сценарий импорта

Сейчас основой импорта являются `diary.csv` и `ratings.csv`.

- `diary.csv` дает реальные просмотры, `Watched Date`, теги, флаг повторного просмотра и дату логирования
- `ratings.csv` дает оценки и помогает выбрать фильмы для TMDB-обогащения
- история просмотров в приложении строится вокруг массива `watches`
- каноническая дата просмотра берется из `diary.csv -> Watched Date`

`watched.csv` не участвует в текущем пользовательском импорте и не требуется для `POST /api/upload`.

## Локальный запуск

```bash
pnpm install
pnpm dev
```

По умолчанию приложение доступно на `http://localhost:3000`.

Сборка и локальный preview:

```bash
pnpm build
pnpm preview
```

## Переменные окружения

Проект читает `.env`.

```env
NUXT_TMDB_TOKEN=<tmdb-api-read-access-token>
NUXT_TMDB_PROXY=http://user:password@host:port
NUXT_TMDB_MIN_RATING=3
NUXT_TMDB_DISABLE_CACHE_READ=true
NUXT_IMPORT_MAX_MOVIES=1000
NUXT_PUBLIC_IMPORT_MOVIES_PER_MINUTE=300
```

`NUXT_TMDB_TOKEN`

- TMDB API Read Access Token
- в `.env` хранится сырой токен, без префикса `Bearer`
- без него пользовательский импорт не сможет выполнить живое TMDB-обогащение

`NUXT_TMDB_PROXY`

- необязательный HTTP(S)-proxy для запросов к TMDB
- приложение предварительно проверяет proxy тестовым запросом и использует его только при успешной проверке

`NUXT_TMDB_MIN_RATING`

- необязательный глобальный порог оценки для TMDB-обогащения
- если переменная не задана, обогащение применяется ко всем фильмам из `ratings.csv`
- если задана, TMDB-запросы идут только для фильмов с рейтингом не ниже порога

`NUXT_TMDB_DISABLE_CACHE_READ`

- необязательный флаг для отключения чтения TMDB-кэша при обогащении
- при `true`/`1` импорт игнорирует `data/tmdb-cache.runtime.json` и `public/tmdb-cache.json`
- запись runtime-кэша в dev при этом сохраняется

`NUXT_IMPORT_MAX_MOVIES`

- необязательный лимит на число фильмов в пользовательском `.zip`-архиве
- если переменная не задана, ограничения нет
- если уникальных фильмов в архиве больше лимита, `POST /api/upload` вернет `400` с ошибкой про максимальное число фильмов

`NUXT_PUBLIC_IMPORT_MOVIES_PER_MINUTE`

- необязательное значение для клиентской предварительной оценки времени и таймера импорта
- не задает и не ограничивает реальную скорость обработки на сервере
- значение задается в фильмах в минуту только для расчета ожидаемой длительности
- если переменная не задана или некорректна, используется `300`

## Скрипты

```bash
pnpm dev
pnpm build
pnpm preview
pnpm lint
pnpm typecheck
```

## Как работает обработка

1. Пользователь либо загружает свой архив, либо запускает демо-профиль.
2. Сервер читает CSV из архива и собирает нормализованные `movies`, `watches` и `stats`.
3. Для фильмов из `ratings.csv`, прошедших порог `minRating`, приложение пытается найти данные в TMDB или в локальном кэше.
4. Готовый результат сохраняется в браузере и используется на страницах `/`, `/movies` и `/directors`.

Важно:

- `POST /api/upload` требует доступный TMDB, иначе вернет `503 TMDB unavailable`
- демо-обработка через `POST /api/process` может работать с `tmdbRequired = false`, если хватает локального кэша

## API

### `POST /api/upload`

Принимает multipart-форму:

- `file` - `.zip`-архив Letterboxd
- `minRating` - необязательный числовой порог

Ограничения:

- только `.zip`
- размер до `2 MB`
- при `NUXT_IMPORT_MAX_MOVIES` число уникальных фильмов в архиве не должно превышать заданный лимит
- внутри архива обязательны `diary.csv` и `ratings.csv`

### `POST /api/process`

Запускает обработку `public/demo.zip`.

JSON body:

- `minRating`
- `tmdbRequired`

### `GET /api/data/[slug]`

Возвращает встроенные JSON-датасеты из `server/data`:

- `diary`
- `movies`
- `profile`
- `ratings`
- `watched`
- `watchlist`

### `POST /api/debug/tmdb-match`

Вспомогательная debug-ручка для проверки TMDB-матчинга.

JSON body:

- `title`
- `year`
- `uri`
- `locale` - необязателен, иначе берется из cookie `i18n_lang`

## Кэш и хранение данных

- последний импорт сохраняется в `IndexedDB` под ключом `letterboxd-import`
- версия хранилища сохраняется отдельно под ключом `letterboxd-import-version`
- в dev TMDB-кэш может обновляться в `data/tmdb-cache.runtime.json`
- в build/preview приложение опирается на `public/tmdb-cache.json`

## Стек

- `Nuxt 4`
- `@nuxt/ui`
- `@nuxtjs/i18n`
- `nuxt-charts`
- `Tailwind CSS 4`
- `undici`
- `adm-zip`
- `idb-keyval`

## Структура проекта

```text
app/
  components/        UI-компоненты, карточки и графики
  composables/       загрузка и хранение импорта, сбор аналитики
  pages/             главная, фильмы, режиссеры
  utils/             аналитика, рейтинги, оценка времени обработки
server/
  api/               upload/process/data/debug endpoints
  data/              встроенные JSON-датасеты для демо и API
  utils/             CSV-нормализация, TMDB, кэш, матчинг
public/
  demo.zip           демо-архив Letterboxd
  tmdb-cache.json    build-safe снимок TMDB-кэша
data/
  tmdb-cache.runtime.json  runtime-кэш TMDB для dev
```

## Ограничения и особенности

- приложение работает с `ssr: false`, поэтому интерфейс полностью клиентский
- индексация отключена через `robots.txt` и meta-теги `noindex`
- без TMDB пользовательский импорт не считается полноценным: часть карточек и графиков завязана на обогащенные данные

## Лицензия

MIT
