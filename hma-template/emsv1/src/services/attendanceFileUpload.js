import supabase from './supabase'

const BUCKET_NAME = 'attendance-files'

// Upload an attendance Excel file to Supabase storage and return the file path
export const uploadAttendanceFile = async (file, year, month) => {
  if (!file) return null

  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `${year}/${month}/${timestamp}_${sanitizedName}`

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw new Error(`File upload failed: ${error.message}`)

  return data.path
}

// Get a public URL for downloading an attendance file
export const getAttendanceFileUrl = (filePath) => {
  if (!filePath) return null

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath)

  return data?.publicUrl || null
}

// Download/retrieve an attendance file by its path
export const downloadAttendanceFile = async (filePath) => {
  if (!filePath) return null

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(filePath)

  if (error) throw new Error(`File download failed: ${error.message}`)

  return data
}
