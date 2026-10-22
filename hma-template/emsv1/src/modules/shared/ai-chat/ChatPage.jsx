import React, { useRef, useState, useEffect } from 'react'
import { CCard, CCardBody, CCardHeader, CAlert, CFormInput, CButton, CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSend } from '@coreui/icons'
import { sendChatMessage } from '../../../services/aiChat'

const ChatPage = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending) return

    const nextMessages = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setSending(true)
    try {
      const reply = await sendChatMessage(nextMessages)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err?.message || 'Failed to get a response. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <strong>AI Assistant</strong>
      </CCardHeader>
      <CCardBody>
        <div
          style={{ minHeight: '320px', maxHeight: '55vh', overflowY: 'auto' }}
          className="mb-3 d-flex flex-column gap-2"
        >
          {!messages.length && (
            <p className="text-body-secondary small mb-0">
              Ask a question about the software or the company&apos;s work.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-2 rounded ${
                m.role === 'user'
                  ? 'bg-primary text-white align-self-end'
                  : 'bg-light align-self-start'
              }`}
              style={{ maxWidth: '80%', whiteSpace: 'pre-wrap' }}
            >
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && (
          <CAlert color="danger" className="small py-2">
            {error}
          </CAlert>
        )}

        <form onSubmit={handleSend} className="d-flex gap-2">
          <CFormInput
            placeholder="Type your message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />
          <CButton type="submit" color="primary" disabled={sending || !input.trim()}>
            {sending ? <CSpinner size="sm" /> : <CIcon icon={cilSend} />}
          </CButton>
        </form>
        <p className="text-danger small mt-2 mb-0 fst-italic">This feature is not yet published.</p>
      </CCardBody>
    </CCard>
  )
}

export default ChatPage
