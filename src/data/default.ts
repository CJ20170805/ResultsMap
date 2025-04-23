import type {
  ResultsMapData,
} from '@/types/ResultsMap'

const defaultMapData: ResultsMapData = {
  mapConfig: {
    title: 'Results Map',
    titleFontSize: 32,
    titleColor: '#000000',
    titleFontWeight: 'bold',
    dividerColor: '#000000',
    dividerWidth: 3,
    layerColors: {
      mission: '#ffcdd2', // Pink
      strategic: '#c8e6c9', // Green
      process: '#bbdefb', // Blue
      operational: '#ffe0b2', // Orange
    },
    layerSizes: {
      mission: { outer: 190, inner: 0 },
      strategic: { outer: 350, inner: 190 },
      process: { outer: 500, inner: 350 },
      operational: { outer: 650, inner: 500 }
    }
  },
  bubbles: [],
  relationships: [],
  groups: [],
  groupLevel: 'strategic',
  legends: {
    legendBubbles: [
      { cx: 60, cy: 210, rx: 46, ry: 38, track: 'operational', text: 'Operational' },
      { cx: 60, cy: 120, rx: 46, ry: 38, track: 'process', text: 'Process' },
      { cx: 60, cy: 30, rx: 46, ry: 38, track: 'strategic', text: 'Strategic' },
      { cx: 60, cy: -60, rx: 46, ry: 38, track: 'mission', text: 'Mission' },
    ],
    legendLines: [
      {
        x: 60,
        y: 282,
        length: 32,
        color: '#000',
        type: 'Cause-Effect',
        text: 'Cause-Effect',
        visible: true,
      },
      {
        x: 60,
        y: 322,
        length: 32,
        color: '#000',
        type: 'Companion',
        text: 'Companion',
        visible: true,
      },
      {
        x: 60,
        y: 360,
        length: 32,
        color: '#000',
        type: 'Conflict',
        text: 'Conflict',
        visible: true,
      },
      {
        x: 60,
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
