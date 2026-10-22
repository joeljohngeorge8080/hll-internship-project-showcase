import supabase from './supabase'

// Drops fields the narrative doesn't need (raw document blobs) before they
// leave the browser.
const trimSection = ({ documents, ...rest }) => rest

// sections: the array returned by reportSections.buildSections(), already
// filtered down to what the user selected.
export const generateNarrative = async (sections) => {
  const { data, error } = await supabase.functions.invoke('bedrock-chat', {
    body: { mode: 'report', sections: sections.map(trimSection) },
  })
  if (error) throw error
  return data.narrative
}
