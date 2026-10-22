import supabase from './supabase'

// messages: [{ role: 'user' | 'assistant', content: string }]
// Returns the assistant's reply text, or throws on failure.
export const sendChatMessage = async (messages) => {
  const { data, error } = await supabase.functions.invoke('bedrock-chat', {
    body: { mode: 'chat', messages },
  })
  if (error) throw error
  return data.reply
}
