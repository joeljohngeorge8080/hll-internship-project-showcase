/**
 * localEmployeePhotos.js — Supabase Storage for Staff & Payroll profile
 * photos. Replaces the old inline-base64 storage in employees.photo_url
 * (bloated table rows, no server-side size/type enforcement) with the same
 * private-bucket + signed-URL shape as localEmployeeDocuments.js. One photo
 * per employee, overwritten in place at "<employee_id>/photo.<ext>".
 */
import supabase from './supabase'
import { PHOTO_MIME_TYPES, uploadWithCleanup } from './storageUtils'

const BUCKET = 'employee-photos'
const MAX_BYTES = 2 * 1024 * 1024 // 2MB/file, matches ProfilePhotoUpload.jsx's client-side cap

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

export const localEmployeePhotos = {
  /** Uploads the file and records its storage path on the employee row. Returns a signed URL for immediate display. */
  async upload(employeeId, file) {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
    const path = `${employeeId}/photo.${ext}`
    await uploadWithCleanup(BUCKET, path, file, {
      maxBytes: MAX_BYTES,
      allowedMimeTypes: PHOTO_MIME_TYPES,
      upsert: true,
    })

    const { error: dbError } = await supabase
      .from('employees')
      .update({ photo_url: path })
      .eq('id', employeeId)
    throwIfError(dbError, 'Failed to save photo reference')

    return this.getSignedUrl(path)
  },

  /** Resolves a stored photo_url into a viewable link. Old rows may still hold
   *  a base64 data: URL from before the Supabase Storage migration — those
   *  are already viewable as-is and are returned unchanged. */
  async getSignedUrl(photoUrl) {
    if (!photoUrl) return null
    if (photoUrl.startsWith('data:') || photoUrl.startsWith('http')) return photoUrl

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(photoUrl, 3600)
    if (error) return null
    return data.signedUrl
  },
}
