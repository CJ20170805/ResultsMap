export type LayerType = 'None' | 'mission' | 'strategic' | 'process' | 'operational'
export type RelationType = 'cause-effect' | 'companion' | 'conflict' | 'lead-lag'

export interface LayerColors {
  mission: string,
  strategic: string,
  process: string,
  operational: string,
}

export interface MapConfig {
  title: string,
  titleFontSize: number,
  layerColors: LayerColors
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

export interface LegendBubbles {
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  track: string,
  text: string
}

export interface LegendLines {
  x: number,
  y: number,
  length: number,
  color: string,
  type: string,
  text: string
}

export interface Legends {
  legendBubbles: LegendBubbles[]
  legendLines: LegendLines[]
}

export interface ResultsMapData {
  mapConfig: MapConfig,
  bubbles: Bubble[]
  relationships: Relationship[]
  groups: Group[]
  groupLevel: LayerType | 'None',
  legends: Legends
}
