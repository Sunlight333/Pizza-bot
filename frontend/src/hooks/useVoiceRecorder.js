import { useEffect, useRef, useState } from 'react'

/**
 * Tiny wrapper around MediaRecorder for chat voice notes.
 *
 * Returns:
 *  - recording        — bool, true while we're capturing
 *  - elapsedMs        — number, time since start (poll @ 100ms while recording)
 *  - start()          — request mic + begin
 *  - stop()           — stop and resolve to { blob, mime, durationMs }
 *  - cancel()         — stop and discard
 *
 * The browser picks the mime; we surface what it chose so the upload's
 * Content-Type matches and the backend's chat_media saver guesses the right
 * file extension. Common outcomes: audio/webm;codecs=opus (Chrome), audio/ogg
 * (Firefox), audio/mp4 (Safari).
 */
export function useVoiceRecorder() {
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const startedAtRef = useRef(0)
  const tickRef = useRef(null)
  const [recording, setRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => () => {
    if (recRef.current && recRef.current.state !== 'inactive') {
      try { recRef.current.stop() } catch (_) {}
    }
    if (tickRef.current) clearInterval(tickRef.current)
  }, [])

  const start = async () => {
    if (recording) return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const rec = new MediaRecorder(stream)
    chunksRef.current = []
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      // Free the mic immediately when recording ends.
      stream.getTracks().forEach((t) => t.stop())
    }
    recRef.current = rec
    startedAtRef.current = Date.now()
    rec.start()
    setRecording(true)
    setElapsedMs(0)
    tickRef.current = setInterval(
      () => setElapsedMs(Date.now() - startedAtRef.current),
      100,
    )
  }

  const stop = () =>
    new Promise((resolve, reject) => {
      const rec = recRef.current
      if (!rec || rec.state === 'inactive') {
        reject(new Error('not recording'))
        return
      }
      const handle = () => {
        rec.removeEventListener('stop', handle)
        clearInterval(tickRef.current)
        const mime = rec.mimeType || (chunksRef.current[0]?.type) || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mime })
        const durationMs = Date.now() - startedAtRef.current
        chunksRef.current = []
        setRecording(false)
        resolve({ blob, mime, durationMs })
      }
      rec.addEventListener('stop', handle)
      rec.stop()
    })

  const cancel = () => {
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch (_) {}
    }
    chunksRef.current = []
    clearInterval(tickRef.current)
    setRecording(false)
    setElapsedMs(0)
  }

  return { recording, elapsedMs, start, stop, cancel }
}

export const formatElapsed = (ms) => {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60).toString().padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
