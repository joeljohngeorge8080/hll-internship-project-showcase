/**
 * localLsgbDocuments.js — Supabase Storage + lsgb_documents metadata
 * for the LSGB Projects page's Files section. Page-level, not tied to
 * individual sheets. Each file is stored at "<timestamp>-<sanitized filename>"
 * in the private 'lsgb-documents' bucket; lsgb_documents holds metadata.
 */
import supabase from './supabase'
import { sanitizeFileName, uploadWithCleanup, cleanupOrphan } from './storageUtils'

const BUCKET = 'lsgb-documents'
const MAX_BYTES = 25 * 1024 * 1024 // 25MB/file

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

export const localLsgbDocuments = {
  async list() {
    const { data, error } = await supabase
      .from('lsgb_documents')
      .select('*')
      .order('uploaded_at', { ascending: false })
    throwIfError(error, 'Failed to load files')
    return data || []
  },

  async upload(file, uploadedBy) {
    const path = `${Date.now()}-${sanitizeFileName(file.name)}`
    await uploadWithCleanup(BUCKET, path, file, { maxBytes: MAX_BYTES })

    const { data, error } = await supabase
      .from('lsgb_documents')
      .insert({
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by_name: uploadedBy || 'Unknown',
      })
      .select()
      .single()
    if (error) {
      await cleanupOrphan(BUCKET, path)
      throw new Error(`Failed to save file metadata: ${error.message}`)
    }
    return data
  },

  async remove(doc) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path])
    throwIfError(storageError, 'Failed to delete file')
    const { error } = await supabase.from('lsgb_documents').delete().eq('id', doc.id)
    throwIfError(error, 'Failed to delete file record')
  },

  /** Private bucket — every view/download goes through a short-lived signed URL. */
  async getSignedUrl(storagePath, { download } = {}) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60, download ? { download } : undefined)
    throwIfError(error, 'Failed to create link')
    return data.signedUrl
  },
}
