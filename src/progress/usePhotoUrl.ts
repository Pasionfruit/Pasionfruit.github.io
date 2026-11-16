import { useEffect, useState } from 'react'
import { fetchTimelinePhotoUrl } from '../data/timeline/client'

/** The photo's bytes as an object URL, released when the photo changes. */
export function usePhotoUrl(idToken: string, photoId: string) {
  const [state, setState] = useState<{ id: string; src: string; failed: boolean }>({ id: '', src: '', failed: false })
  useEffect(() => {
    const controller = new AbortController()
    let url = ''
    fetchTimelinePhotoUrl(idToken, photoId, controller.signal)
      .then((u) => {
        url = u
        setState({ id: photoId, src: u, failed: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ id: photoId, src: '', failed: true })
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [idToken, photoId])
  return state.id === photoId ? state : { id: photoId, src: '', failed: false }
}

