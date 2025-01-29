import type {
  ResultsMapData,
} from '@/types/ResultsMap'

const defaultMapData: ResultsMapData = {
  mapConfig: {
    title: 'Results Map',
    titleFontSize: 28,
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
      { cx: 30, cy: 250, rx: 40, ry: 34, track: 'operational', text: 'Operational' },
      { cx: 30, cy: 170, rx: 40, ry: 34, track: 'process', text: 'Process' },
      { cx: 30, cy: 90, rx: 40, ry: 34, track: 'strategic', text: 'Strategic' },
      { cx: 30, cy: 10, rx: 40, ry: 34, track: 'mission', text: 'Mission' },
    ],
    legendLines: [
      {
        x: 30,
        y: 310,
        length: 32,
        color: '#666',
        type: 'Cause-Effect',
        text: 'Cause-Effect',
        visible: true,
      },
      {
        x: 30,
        y: 344,
        length: 32,
        color: '#666',
        type: 'Conflict',
        text: 'Conflict',
        visible: true,
      },
      {
        x: 30,
        y: 378,
        length: 32,
        color: '#666',
        type: 'Companion',
        text: 'Companion',
        visible: true,
      },
      {
        x: 30,
        y: 412,
        length: 32,
        color: '#666',
        type: 'Lead-Lag',
        text: 'Lead-Lag',
        visible: true,
      },
    ],
  },
}


export default defaultMapData;
