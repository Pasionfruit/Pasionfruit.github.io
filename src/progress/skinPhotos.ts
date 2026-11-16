import { putPhotoBytes, removePhotoBytes } from '../data/timeline/client'
import { saveRow, type SkinPhoto } from './client'

/** Store a skin photo (private R2 bytes plus its row) and return the row. Cleans up the bytes if the row fails. */
export async function addSkinPhoto(idToken: string, file: File, takenAt: string, angle: string, notes = ''): Promise<SkinPhoto> {
  const photoId = crypto.randomUUID()
  const row: SkinPhoto = { photo_id: photoId, taken_at: takenAt, angle, notes, marks: '[]', verified: '', created_at: new Date().toISOString() }
  await putPhotoBytes(idToken, photoId, file)
  try {
    await saveRow(idToken, 'progress_skin_photos', row)
  } catch (caught) {
    await removePhotoBytes(idToken, photoId)
    throw caught
  }
  return row
}
