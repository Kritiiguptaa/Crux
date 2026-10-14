/**
 * Loads a saved area-card image through the API and shows it. The bytes are
 * turned into an object URL that is revoked on unmount to avoid leaks.
 */
import { useEffect, useState } from 'react'
import { api } from '@renderer/lib/api'

interface AreaImageProps {
  imagePath: string
  className?: string
}

export function AreaImage({ imagePath, className }: AreaImageProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    let objectUrl: string | null = null
    api.cards
      .getAreaImage({ imagePath })
      .then((bytes) => {
        if (revoked) return
        // Cast: IPC gives a generic Uint8Array<ArrayBufferLike>, which TS 5.7
        // won't narrow to BlobPart; the bytes are a normal array buffer.
        objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }))
        setUrl(objectUrl)
      })
      .catch(() => setUrl(null))
    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imagePath])

  if (!url) return <div className={`bg-gray-100 ${className ?? ''}`} />
  return <img src={url} alt="Captured area" className={className} />
}
