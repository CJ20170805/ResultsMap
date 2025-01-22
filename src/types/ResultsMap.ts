export type LayerType = 'mission' | 'strategic' | 'process' | 'operational'
export type RelationType = 'cause-effect' | 'companion' | 'conflict' | 'lead-lag'

export interface MapConfig {
  title: string,
  fontSize: number
}

export interface Group {
    id: string
    name: string
    // layers: LayerType[]
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
  mapConfig: MapConfig,
  bubbles: Bubble[]
  relationships: Relationship[]
  groups: Group[]
  groupLevel: LayerType | 'None'
}
