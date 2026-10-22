/**
 * localProjectDocuments.js — Supabase Storage + project_documents metadata
 * for the Projects > Upload tab. Each file is stored at
 * "<project_id>/<timestamp>-<sanitized filename>" in the private
 * 'project-documents' bucket; project_documents holds one metadata row per
 * upload (name, size, mime type, uploader, timestamp) so the list can be
 * rendered without listing the bucket directly.
 */
import supabase from './supabase'
import {
  DOCUMENT_MIME_TYPES,
  sanitizeFileName,
  uploadWithCleanup,
  cleanupOrphan,
} from './storageUtils'

const BUCKET = 'project-documents'
const MAX_BYTES = 25 * 1024 * 1024 // 25MB/file

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

export const localProjectDocuments = {
  async list(projectId) {
    const { data, error } = await supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false })
    throwIfError(error, 'Failed to load documents')
    return data || []
  },

  async upload(projectId, file, uploadedBy) {
    const path = `${projectId}/${Date.now()}-${sanitizeFileName(file.name)}`
    await uploadWithCleanup(BUCKET, path, file, {
      maxBytes: MAX_BYTES,
      allowedMimeTypes: DOCUMENT_MIME_TYPES,
    })

    const { data, error } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by_name: uploadedBy || 'Unknown',
      })
      .select()
      .single()
    if (error) {
      // Metadata insert failed — remove the now-orphaned storage object
      // rather than leaving a file with no listing/RLS-checkable row.
      await cleanupOrphan(BUCKET, path)
      throw new Error(`Failed to save document metadata: ${error.message}`)
    }
    return data
  },

  async remove(doc) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path])
    throwIfError(storageError, 'Failed to delete file')
    const { error } = await supabase.from('project_documents').delete().eq('id', doc.id)
    throwIfError(error, 'Failed to delete document record')
  },

  /** Private bucket — every download goes through a short-lived signed URL. */
  async getDownloadUrl(storagePath) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60)
    throwIfError(error, 'Failed to create download link')
    return data.signedUrl
  },
}
