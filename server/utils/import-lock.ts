import { createError } from 'h3'

let isUploadImportInProgress = false

function getBusyImportMessage(locale: string) {
  return locale.toLowerCase().startsWith('ru')
    ? 'Сервер сейчас занят другой обработкой. Пожалуйста, попробуйте позже.'
    : 'The server is currently busy processing another import. Please try again later.'
}

export async function withUploadImportLock<T>(locale: string, run: () => Promise<T>) {
  if (isUploadImportInProgress) {
    const message = getBusyImportMessage(locale)

    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message,
      data: { message }
    })
  }

  isUploadImportInProgress = true

  try {
    return await run()
  } finally {
    isUploadImportInProgress = false
  }
}
