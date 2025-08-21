import { Record, ActionHash } from '@holochain/client'

export interface CreateExchangeResponseInput {
  target_entity_hash: ActionHash
  service_details: string
  terms: string
  exchange_medium: string
  exchange_value?: string
  delivery_timeframe?: string
  notes?: string
}

export interface ExchangeResponse {
  service_details: string
  terms: string
  exchange_medium: string
  exchange_value?: string
  delivery_timeframe?: string
  notes?: string
  status: 'Pending' | 'Approved' | 'Rejected'
  created_at: number
  updated_at: number
}

export const sampleResponseInput = (targetHash: ActionHash): CreateExchangeResponseInput => ({
  target_entity_hash: targetHash,
  service_details: 'I can provide web development services',
  terms: 'Payment upon completion',
  exchange_medium: 'CAD',
  exchange_value: '500',
  delivery_timeframe: '2 weeks',
  notes: 'Experienced in React and TypeScript'
})