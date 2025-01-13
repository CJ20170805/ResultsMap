export type LayerType = 'mission' | 'strategic' | 'process' | 'operational'

export interface Group {
    id: string
    name: string
    layers: LayerType[]
    startAngle?: number
    endAngle?: number
}

export interface Bubble {
    id: string
    text: string
    layer: LayerType
    groupId: string
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
  groups: Group[]
} 