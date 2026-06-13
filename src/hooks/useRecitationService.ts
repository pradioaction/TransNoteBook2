import { useMemo } from 'react'
import { createRecitationService, type RecitationService } from '@/services/recitationService'

let _service: RecitationService | null = null

function getService(): RecitationService {
  if (!_service) {
    _service = createRecitationService()
  }
  return _service
}

export function useRecitationService(): RecitationService {
  return useMemo(() => getService(), [])
}
