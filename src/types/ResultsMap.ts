export type LayerType = 'mission' | 'strategic' | 'process' | 'operational'
export type RelationType = 'cause-effect' | 'companion' | 'conflict' | 'lead-lag'
export type ExportType = 'png' | 'pdf' | 'json'

export interface LayerColors {
  mission: string,
  strategic: string,
  process: string,
  operational: string,
}

export interface MapConfig {
  title: string,
  titleFontSize: number,
  layerColors: LayerColors,
  date?: string,
  titleX?: number,
  titleY?: number
}

export interface Group {
    id: string
    name: string
    // layers: LayerType[]
    startAngle?: number
    endAngle?: number
    x?: number   // coordinates of the group name
    y?: number
    locked: boolean
    isDragging: boolean
    visible: boolean
}

export interface Bubble {
    id: string
    text: string
    layer: LayerType
    groupId: string
    locked: boolean
    x?: number
    y?: number
    visible: boolean
    rx?: number
    ry?: number
    fontColor?: string
    fontSize?: number,
    fontWeight?: string
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
  text: string,
  visible: boolean,
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
