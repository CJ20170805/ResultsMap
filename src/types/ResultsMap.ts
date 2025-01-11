export type LayerType = 'mission' | 'strategic' | 'process' | 'operational'

export type RelationType = 'cause-effect' | 'companion' | 'conflict'

export interface Bubble {
  id: string
  text: string
  layer: LayerType
  x?: number
  y?: number
}

export interface Relationship {
  id: string
  source: string
  target: string
  type: RelationType
}

export interface ResultsMapData {
  bubbles: Bubble[]
  relationships: Relationship[]
} 