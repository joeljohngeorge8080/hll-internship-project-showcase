/**
 * localEmployeeDocuments.js — Supabase Storage + employee_documents metadata
 * for the Staff & Payroll > Documents tab. Same two-tier shape as
 * localProjectDocuments.js: each file is stored at
 * "<employee_id>/<timestamp>-<sanitized filename>" in the private
 * 'employee-documents' bucket; employee_documents holds one metadata row per
 * upload so the list can be rendered without listing the bucket directly.
 */
import supabase from './supabase'
import {
  DOCUMENT_MIME_TYPES,
  sanitizeFileName,
  uploadWithCleanup,
  cleanupOrphan,
} from './storageUtils'

const BUCKET = 'employee-documents'
const MAX_BYTES = 10 * 1024 * 1024 // 10MB/file, matches DocumentsTab.jsx's client-side cap

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

export const localEmployeeDocuments = {
  async list(employeeId) {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employeeId)
      .order('uploaded_at', { ascending: false })
    throwIfError(error, 'Failed to load documents')

    const withUrls = await Promise.all(
      (data || []).map(async (doc) => {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(doc.storage_path, 60)
        return { ...doc, download_url: signed?.signedUrl || null }
      }),
    )
    return withUrls
  },

  async upload(employeeId, file, { documentName, documentCategory, remarks }) {
    const path = `${employeeId}/${Date.now()}-${sanitizeFileName(file.name)}`
    await uploadWithCleanup(BUCKET, path, file, {
      maxBytes: MAX_BYTES,
      allowedMimeTypes: DOCUMENT_MIME_TYPES,
    })

    const { data, error } = await supabase
      .from('employee_documents')
      .insert({
        employee_id: employeeId,
        document_name: documentName,
        document_category: documentCategory,
        file_name: file.name,
        content_type: file.type || null,
        file_size_bytes: file.size,
        remarks: remarks || null,
        storage_path: path,
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
    const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id)
    throwIfError(error, 'Failed to delete document record')
  },
}
