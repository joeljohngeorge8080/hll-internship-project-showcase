/**
 * storageUtils.js — shared Supabase Storage upload helper.
 * Every private-bucket upload flow (employee/project documents, employee
 * photos, pool expense receipts) follows the same shape: validate size/type,
 * sanitize the filename, upload the object, then write a metadata row — and
 * roll the storage object back if that metadata write fails. Centralized
 * here so the callers don't drift from each other. The MIME allowlists below
 * mirror the bucket-level `allowed_mime_types` config set in
 * 00000000000053_storage_mime_allowlist.sql, which is the server-side
 * backstop for a client that skips this check.
 */
import supabase from './supabase'

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const RECEIPT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export const sanitizeFileName = (name) => name.replace(/[^\w.\- ]/g, '_')

/**
 * Validates and uploads a file to a bucket. Throws before making a network
 * request if the file exceeds maxBytes or isn't in allowedMimeTypes.
 */
export async function uploadWithCleanup(
  bucket,
  path,
  file,
  { maxBytes, allowedMimeTypes, upsert = false } = {},
) {
  if (maxBytes && file.size > maxBytes) {
    throw new Error(`File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit`)
  }
  if (allowedMimeTypes && !allowedMimeTypes.includes(file.type)) {
    throw new Error(`File type not allowed (accepted: ${allowedMimeTypes.join(', ')})`)
  }
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert })
  if (error) throw new Error(`Failed to upload file: ${error.message}`)
}

/** Removes an orphaned storage object after a subsequent metadata write fails. */
export async function cleanupOrphan(bucket, path) {
  await supabase.storage.from(bucket).remove([path])
}
