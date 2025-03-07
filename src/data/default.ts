import type {
  ResultsMapData,
} from '@/types/ResultsMap'

const defaultMapData: ResultsMapData = {
  mapConfig: {
    title: 'Results Map',
    titleFontSize: 32,
    layerColors: {
      mission: '#ffcdd2', // Pink
      strategic: '#c8e6c9', // Green
      process: '#bbdefb', // Blue
      operational: '#ffe0b2', // Orange
    },
  },
  bubbles: [
    // { id: '1', text: 'fires are prevented', layer: 'strategic', groupId: '1', locked: false },
    // { id: '2', text: 'less injury from fire incidents', layer: 'mission', groupId: '1', locked: false },
    // { id: '3', text: 'crews arrive at emergencies quickly', layer: 'process', groupId: '2', locked: false },
    // { id: '4', text: 'transit without bottlenecks', layer: 'operational', groupId: '3', locked: false },
  ],
  relationships: [
    // { id: '1', source: '1', target: '2', type: 'cause-effect' },
    // { id: '2', source: '3', target: '4', type: 'companion' },
    // { id: '3', source: '1', target: '4', type: 'conflict' },
  ],
  groups: [
    // { id: '1', name: 'G1', startAngle: 0, endAngle: 2 },
    // { id: '2', name: 'G2', startAngle: 2, endAngle: 4 },
    // { id: '3', name: 'GROUP3 WITH A LONG NAME', startAngle: 4, endAngle: 6 },
  ],
  groupLevel: 'strategic',
  legends: {
    legendBubbles: [
      { cx: 40, cy: 210, rx: 46, ry: 38, track: 'operational', text: 'Operational' },
      { cx: 40, cy: 120, rx: 46, ry: 38, track: 'process', text: 'Process' },
      { cx: 40, cy: 30, rx: 46, ry: 38, track: 'strategic', text: 'Strategic' },
      { cx: 40, cy: -60, rx: 46, ry: 38, track: 'mission', text: 'Mission' },
    ],
    legendLines: [
      {
        x: 40,
        y: 282,
        length: 32,
        color: '#000',
        type: 'Cause-Effect',
        text: 'Cause-Effect',
        visible: true,
      },
      {
        x: 40,
        y: 322,
        length: 32,
        color: '#000',
        type: 'Companion',
        text: 'Companion',
        visible: true,
      },
      {
        x: 40,
        y: 360,
        length: 32,
        color: '#000',
        type: 'Conflict',
        text: 'Conflict',
        visible: true,
      },
      {
        x: 40,
        y: 398,
        length: 32,
        color: '#000',
        type: 'Lead-Lag',
        text: 'Lead-Lag',
        visible: true,
      },
    ],
  },
}


export default defaultMapData;
