<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as d3 from 'd3'
import type {
  ResultsMapData,
  Bubble,
  Relationship,
  Group,
  LayerType,
  LayerColors,
} from '@/types/ResultsMap'
// import { Plus, Minus } from '@element-plus/icons-vue'

const props = defineProps<{
  data: ResultsMapData
}>()

const svgRef = ref<SVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const width = 1200
const height = 1100
const centerX = width / 2 + 50
const centerY = height / 2 - 40
const yScale = 0.9
const yOffset = 50
const scale = ref(1)

const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedBubble = ref<Bubble | null>(null)
const newText = ref('')

const relationshipTypes = ['cause-effect', 'companion', 'conflict', 'lead-lag']

// Initialize zoom behavior
const zoom = d3.zoom()
  .scaleExtent([0.1, 10]) // Set minimum and maximum zoom scale
  .on('zoom', (event) => {
    console.log("onZoom...", event);

    // Apply the zoom transformation to the SVG
    d3.select(svgRef.value).select('g')
      .attr('transform', event.transform);
  });

// Attach zoom behavior to the SVG
// const svg = d3.select(svgRef.value).call(zoom);

const updateRelationshipType = (relationship: Relationship, newType: string) => {
  relationship.type = newType as Relationship['type']
  drawMap()
}

const removeRelationship = (relationship: Relationship) => {
  const index = props.data.relationships.findIndex((rel) => rel.id === relationship.id)
  if (index !== -1) {
    props.data.relationships.splice(index, 1)
    drawMap()
  }
}

const showContextMenu = (event: MouseEvent, bubble: Bubble) => {
  event.preventDefault()
  selectedBubble.value = bubble
  newText.value = bubble.text
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

const hideContextMenu = () => {
  contextMenuVisible.value = false
  selectedBubble.value = null
}

const updateBubbleText = () => {
  if (selectedBubble.value) {
    selectedBubble.value.text = newText.value
    drawMap()
    hideContextMenu()
  }
}

const confirmRemoveBubble = () => {
  //if (confirm('Are you sure you want to remove this bubble?')) {
  removeBubble()
  //}
}

const removeBubble = () => {
  if (selectedBubble.value) {
    const index = props.data.bubbles.findIndex((b) => b.id === selectedBubble.value!.id)
    if (index !== -1) {
      props.data.bubbles.splice(index, 1)
      drawMap()
      hideContextMenu()
    }
  }
}

// Define track boundaries with inner and outer radii
const tracks = {
  mission: { outer: 150, inner: 0 }, // Pink (innermost)
  strategic: { outer: 280, inner: 150 }, // Green
  process: { outer: 410, inner: 280 }, // Blue
  operational: { outer: 540, inner: 410 }, // Orange (outermost)
}

// Calculate the middle radius for bubble positioning
const layerRadii = {
  mission: (tracks.mission.outer + tracks.mission.inner) / 2,
  strategic: (tracks.strategic.outer + tracks.strategic.inner) / 2,
  process: (tracks.process.outer + tracks.process.inner) / 2,
  operational: (tracks.operational.outer + tracks.operational.inner) / 2,
}

// Layer colors
// const layerColors = {
//   mission: '#ffcdd2', // Pink
//   strategic: '#c8e6c9', // Green
//   process: '#bbdefb', // Blue
//   operational: '#ffe0b2', // Orange
// }

// Add function to calculate group angles
function calculateGroupAngles(groups: Group[], bubbles: Bubble[]) {
  const totalAngle = 2 * Math.PI
  const groupedBubbles = bubbles.filter((b) => b.groupId !== '')
  //const ungroupedBubbles = bubbles.filter((b) => b.groupId === '')

  // Calculate angles for groups
  let currentAngle = 0
  groups.forEach((group) => {
    const groupBubbles = groupedBubbles.filter((b) => b.groupId === group.id)
    const angleShare = (groupBubbles.length / bubbles.length) * totalAngle
    group.startAngle = currentAngle
    group.endAngle = currentAngle + angleShare
    currentAngle += angleShare
  })

  return groups
}

// Add function to draw group dividers
function drawGroupDividers(
  svg: d3.Selection<SVGElement | null, unknown, null, undefined>,
  groups: Group[],
  startLayer: LayerType = 'None' as LayerType,
) {
  if (groups.length <= 1) return
  const dividerGroup = svg.append('g').attr('class', 'group-dividers')

  groups.forEach((group) => {
    if (group.startAngle !== undefined && group.endAngle !== undefined) {
      let startX, startY

      if (startLayer === ('None' as LayerType)) return // Skip drawing dividers if startLayer is None

      if (startLayer === 'mission') {
        // Start from the center if the startLayer is mission
        startX = centerX
        startY = centerY
      } else {
        // Start from the middle of the specified startLayer
        startX = centerX + Math.cos(group.startAngle) * tracks[startLayer].inner
        startY = centerY + yOffset + Math.sin(group.startAngle) * tracks[startLayer].inner * yScale
      }
      const endX = centerX + Math.cos(group.startAngle) * tracks.operational.outer
      const endY =
        centerY + yOffset + Math.sin(group.startAngle) * tracks.operational.outer * yScale

      dividerGroup
        .append('line')
        .attr('x1', startX)
        .attr('y1', startY)
        .attr('x2', endX)
        .attr('y2', endY)
        .attr('stroke', 'white')
        .attr('stroke-width', 3)
    }
  })
}

// Function to add group names
function addGroupNames(
  svg: d3.Selection<SVGElement | null, unknown, null, undefined>,
  groups: Group[],
) {
  const drag = d3
    .drag()
    .on('start', function (this: SVGTextElement) {
      d3.select(this).raise().attr('stroke', 'black')
    })
    .on(
      'drag',
      function (this: SVGTextElement, event: d3.D3DragEvent<SVGTextElement, unknown, unknown>) {
        d3.select(this).attr('x', event.x).attr('y', event.y)
      },
    )
    .on('end', function (this: SVGTextElement) {
      d3.select(this).attr('stroke', null)
    })

  groups.forEach((group) => {
    if (group.startAngle !== undefined && group.endAngle !== undefined) {
      const angle = (group.startAngle + group.endAngle) / 2
      const radius = tracks['operational'].outer + 40 // Offset
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + yOffset + radius * Math.sin(angle) * yScale

      svg
        .append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .text(group.name)
        .style('font-weight', 'bold')
        .style('font-size', '18px')
        .style('fill', '#000')
        .style('cursor', 'move')
        .call(drag) // Make the text draggable
    }
  })
}

// Add arrows and title
function addArrowsAndTitle(svg: d3.Selection<SVGElement | null, unknown, null, undefined>){
  // Define arrow marker
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#666')

  // Define dot marker
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'dot')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .append('circle')
    .attr('cx', '5')
    .attr('cy', '5')
    .attr('r', '3')
    .attr('fill', '#666')

  // Define start arrow marker for conflict
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'start-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#666')

  // Define end arrow marker for conflict
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'end-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#666')

  // Define start line arrow marker
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'start-line-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '4')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 5 L 10 5 M 5 0 L 0 5 L 5 10')
    .attr('fill', 'none')
    .attr('stroke', '#666')
    .attr('stroke-width', 1.5)

  // Define end line arrow marker
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'end-line-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 5 L 10 5 M 5 0 L 10 5 L 5 10')
    .attr('fill', 'none')
    .attr('stroke', '#666')
    .attr('stroke-width', 1.5)

  // Add title at the top of the map
  svg
    .append('text')
    .attr('x', '55%')
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .text(props.data.mapConfig.title)
    .style('font-weight', 'bold')
    .style('font-size', `${props.data.mapConfig.titleFontSize}px`)
    .style('fill', '#000')

}

const drawMap = () => {
  console.log('Map Data', props.data)
  if (!svgRef.value) return

  const svg = d3.select(svgRef.value).call(zoom);
  svg.selectAll('*').remove()

   // Create or select the <g> element for the map content
  let mapGroup = svg.select('g.map-group');
  if (mapGroup.empty()) {
    mapGroup = svg.append('g').attr('class', 'map-group');
  }

  // Apply scale transformation
  //svg.attr('transform', `scale(${scale.value})`)

  // Define arrows and title
  addArrowsAndTitle(mapGroup);

  // Calculate group angles
  const updatedGroups = calculateGroupAngles(props.data.groups, props.data.bubbles)

  // Draw layers (concentric circles)
  Object.entries(tracks)
    .reverse()
    .forEach(([layer, radii]) => {
      mapGroup
        .append('ellipse')
        .attr('cx', centerX)
        .attr('cy', centerY + yOffset)
        .attr('rx', radii.outer)
        .attr('ry', radii.outer * yScale)
        .attr('fill', props.data.mapConfig.layerColors[layer as keyof LayerColors])
        .attr('opacity', 0.3)
    })

  // Draw group dividers with configurable starting layer
  drawGroupDividers(mapGroup, updatedGroups, props.data.groupLevel) // Start from the center if the startLayer is mission

  // Position bubbles along their orbits
  props.data.bubbles.forEach((bubble, i) => {
    if (bubble.locked) return

    let angle: number
    if (bubble.groupId) {
      // Find bubble's group
      const group = updatedGroups.find((g) => g.id === bubble.groupId)
      if (group && group.startAngle !== undefined && group.endAngle !== undefined) {
        // Position bubble within its group's angle range
        const groupBubbles = props.data.bubbles.filter((b) => b.groupId === group.id)
        const bubbleIndex = groupBubbles.findIndex((b) => b.id === bubble.id)
        const angleStep = (group.endAngle - group.startAngle) / groupBubbles.length
        angle = group.startAngle + angleStep * bubbleIndex + angleStep / 2
      } else {
        angle = (i * (2 * Math.PI)) / props.data.bubbles.length
      }
    } else {
      angle = (i * (2 * Math.PI)) / props.data.bubbles.length
    }
    const radius = layerRadii[bubble.layer as keyof typeof layerRadii]
    bubble.x = centerX + radius * Math.cos(angle)
    bubble.y = centerY + +yOffset + radius * Math.sin(angle) * yScale
  })

  // Add group names
  addGroupNames(mapGroup, updatedGroups)

  // Constants for bubble sizing
  // let BUBBLE_RADIUS = 15
  // const BUBBLE_RADIUS_X = 55
  // const BUBBLE_RADIUS_Y = 45
  const OFFSET = 4 // Adjust this value to control how far outside the bubbles the lines should start/end
  const TEXT_WIDTH = 120
  const BUBBLE_PADDING_X = 20 // Horizontal padding around the text inside the bubble
  const BUBBLE_PADDING_Y = 25

  // Draw bubbles
  const bubbleGroup = mapGroup.append('g')
  const bubbleRadii = new Map<string, { rx: number; ry: number }>()
  const drag = d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended)

  props.data.bubbles.forEach((bubble) => {

    const g = bubbleGroup
      .append('g')
      .datum(bubble) // Bind the bubble data to the element
      .attr('transform', `translate(${bubble.x},${bubble.y})`)
      .style('cursor', 'move')
      .on('contextmenu', (event: MouseEvent) => showContextMenu(event, bubble)) // Add right-click event
      .call(drag) // Apply drag behavior

    const textElement = g
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('fill', '#000')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(bubble.text)
      .call(wrap, TEXT_WIDTH)

    // Measure the text dimensions
    const textBBox = textElement.node().getBBox()
    const textWidth = textBBox.width
    const textHeight = textBBox.height

    // Adjust the bubble size based on the text dimensions
    const bubbleRadiusX = textWidth / 2 + BUBBLE_PADDING_X
    const bubbleRadiusY = textHeight / 2 + BUBBLE_PADDING_Y

    bubbleRadii.set(bubble.id, { rx: bubbleRadiusX, ry: bubbleRadiusY })

    g.append('ellipse')
      .attr('rx', bubbleRadiusX)
      .attr('ry', bubbleRadiusY)
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .attr(
        'fill',
        props.data.mapConfig.layerColors[
          bubble.layer as keyof typeof props.data.mapConfig.layerColors
        ],
      )
      .attr('opacity', 0.8)
      .lower()
  })

  let initX: number, initY: number;
  let initMouseX: number, initialMouseY: number;

  function dragstarted(this: SVGElement,event: d3.D3DragEvent<SVGTextElement, Bubble, unknown>, d: Bubble) {
    console.log('StartDrag: ', event.x,  event.y);

    const [x, y] = d3.pointer(event, svgRef.value!);

    initX = d.x;
    initY = d.y;

    initMouseX = x;
    initialMouseY = y;

   // d3.select(this).raise().classed('active', true)
   d3.select(this).raise().attr('stroke', 'black')
  }

  function dragged(event: d3.D3DragEvent<SVGTextElement, unknown, unknown>, d: Bubble) {
    console.log('Dragged: ', event, d)
    const [x, y] = d3.pointer(event, svgRef.value!);

   // d3.select(this).attr('transform', `translate(${event.x},${event.y})`)

   const deltaX = x - initMouseX;
   const deltaY = y - initialMouseY;

    // Update the position of the dragged bubble
    const bubble = props.data.bubbles.find((b) => b.id === d.id)
    if (bubble) {

      bubble.x = initX + deltaX;
      bubble.y = initY + deltaY;
      bubble.locked = true

      //d3.select(this).attr('transform', `translate(${bubble.x},${bubble.y})`)
    }

    // Update the paths dynamically
    //updateRelationships();
  }

  function dragended(this: SVGAElement) {
    d3.select(this).attr('stroke', null)
  }

  function updateRelationships() {
    linkGroup.selectAll('path').attr('d', (rel: { source: string; target: string; }) => {
      const source = props.data.bubbles.find((b) => b.id === rel.source)
      const target = props.data.bubbles.find((b) => b.id === rel.target)

      if (!source || !target) return null

      const dx = target.x - source.x
      const dy = target.y - source.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const unitX = dx / distance
      const unitY = dy / distance

      const sourceRadius = bubbleRadii.get(source.id)
      const targetRadius = bubbleRadii.get(target.id)

      if (!sourceRadius || !targetRadius) return null

      const startX = source.x + unitX * (sourceRadius.rx + OFFSET)
      const startY = source.y + unitY * (sourceRadius.ry + OFFSET)
      const endX = target.x - unitX * (targetRadius.rx + OFFSET)
      const endY = target.y - unitY * (targetRadius.ry + OFFSET)

      const controlX = (startX + endX) / 2 + unitY * 50
      const controlY = (startY + endY) / 2 - unitX * 50

      console.log(
        'Updated Path:',
        `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
      )

      return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`
    })
  }

  // Draw relationships
  const linkGroup = mapGroup.append('g')
  props.data.relationships.forEach((rel) => {
    const source = props.data.bubbles.find((b) => b.id === rel.source)
    const target = props.data.bubbles.find((b) => b.id === rel.target)

    if (!source || !target) return

    const dx = target.x - source.x
    const dy = target.y - source.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const unitX = dx / distance
    const unitY = dy / distance

    const sourceRadius = bubbleRadii.get(source.id)
    const targetRadius = bubbleRadii.get(target.id)

    if (!sourceRadius || !targetRadius) return

    const startX = source.x + unitX * (sourceRadius.rx + OFFSET)
    const startY = source.y + unitY * (sourceRadius.ry + OFFSET)
    const endX = target.x - unitX * (targetRadius.rx + OFFSET)
    const endY = target.y - unitY * (targetRadius.ry + OFFSET)

    const controlX = (startX + endX) / 2 + unitY * 50
    const controlY = (startY + endY) / 2 - unitX * 50

    const line = linkGroup
      .append('path')
      .attr('d', `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`)
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')

    if (rel.type === 'cause-effect') {
      line.attr('marker-end', 'url(#arrow)')
    } else if (rel.type === 'companion') {
      line.attr('marker-start', 'url(#dot)').attr('marker-end', 'url(#dot)')
    } else if (rel.type === 'conflict') {
      line.attr('marker-start', 'url(#start-line-arrow)').attr('marker-end', 'url(#end-line-arrow)')
    } else if (rel.type === 'lead-lag') {
      line.attr('marker-end', 'url(#end-line-arrow)')
    }
  })

  // Add legend to the bottom-left corner
  const legendGroup = mapGroup
    .append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(-100, ${height - 500})`) // Adjust the position as needed

  // Add background rectangle for legend
  legendGroup
    .append('rect')
    .attr('x', -20)
    .attr('y', -60)
    .attr('width', 100)
    .attr('height', 500)
    .attr('fill', '#f8f8f8')
    .attr('stroke', '#000')
    .attr('stroke-width', 0)

  // Add "Legend" text at the top
  legendGroup
    .append('text')
    .attr('x', 30)
    .attr('y', -44)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .text('Legend')
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .style('fill', '#000')

  // Add legend bubbles
  // const legendBubbles = [
  //   { cx: 30, cy: 250, rx: 40, ry: 30, track: 'operational', text: 'Operational' },
  //   { cx: 30, cy: 180, rx: 40, ry: 30, track: 'process', text: 'Process' },
  //   { cx: 30, cy: 110, rx: 40, ry: 30, track: 'strategic', text: 'Strategic' },
  //   { cx: 30, cy: 40, rx: 40, ry: 30, track: 'mission', text: 'Mission' },
  // ]

  props.data.legends.legendBubbles.forEach((bubble, index) => {
    legendGroup
      .append('ellipse')
      .attr('cx', bubble.cx)
      .attr('cy', bubble.cy)
      .attr('rx', bubble.rx)
      .attr('ry', bubble.ry)
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .attr(
        'fill',
        props.data.mapConfig.layerColors[
          bubble.track as keyof typeof props.data.mapConfig.layerColors
        ],
      )

    const textElement = legendGroup
      .append('text')
      .attr('x', bubble.cx)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .style('font-size', '12px')
      .style('fill', '#000')

    const words = bubble.text.split(' ').filter((word) => word.trim() !== '')
    const lineHeight = 1.1 // Adjust line height as needed
    const fontSize = 12 // Font size in pixels
    const totalHeight = lineHeight * (words.length - 1) * fontSize // Total height of the text

    // Ensure the total height does not exceed the bubble's height
    const maxHeight = bubble.ry * 2
    const adjustedLineHeight =
      totalHeight > maxHeight ? maxHeight / (words.length - 1) : lineHeight * fontSize

    let initialY = bubble.cy - (adjustedLineHeight * (words.length - 1)) / 2

    switch (words.length) {
      case 1:
        break
      case 2:
        initialY += 6
        break
      case 3:
        initialY += 8
        break
      default:
        initialY += 6
        break
    }

    words.forEach((word, i) => {
      textElement
        .append('tspan')
        .attr('x', bubble.cx)
        .attr('y', initialY + i * adjustedLineHeight)
        .text(word)
    })

    if (index < props.data.legends.legendBubbles.length - 1) {
      legendGroup
        .append('line')
        .attr('x1', bubble.cx)
        .attr('y1', bubble.cy - bubble.ry)
        .attr('x2', bubble.cx)
        .attr(
          'y2',
          props.data.legends.legendBubbles[index + 1].cy +
            props.data.legends.legendBubbles[index + 1].ry +
            3,
        )
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5)
        .attr('marker-end', 'url(#arrow)')
    }
  })

  // Add vertical legend lines with text at the top
  // const legendLines = [
  //   { x: 30, y: 310, length: 30, color: '#666', text: 'Cause-Effect' },
  //   { x: 30, y: 344, length: 30, color: '#666', text: 'Conflict' },
  //   { x: 30, y: 378, length: 30, color: '#666', text: 'Companion' },
  //   { x: 30, y: 412, length: 30, color: '#666', text: 'Lead-Lag' },
  // ]
  let currentY = 0
  props.data.legends.legendLines.forEach((line) => {
    if (line.visible) {
      legendGroup
        .append('text')
        .attr('x', line.x)
        .attr('y', line.y - currentY)
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .text(line.text)
        .style('font-size', '12px')
        .style('fill', '#000')

      const legendLine = legendGroup
        .append('line')
        .attr('x1', line.x - line.length)
        .attr('y1', line.y + 12 - currentY)
        .attr('x2', line.x + line.length)
        .attr('y2', line.y + 12 - currentY)
        .attr('stroke', line.color)
        .attr('stroke-width', 1.5)

      if (line.type === 'Cause-Effect') {
        // Add arrow marker
        legendLine.attr('marker-end', 'url(#arrow)')
      } else if (line.type === 'Companion') {
        // Add circles at both ends
        legendLine.attr('marker-start', 'url(#dot)').attr('marker-end', 'url(#dot)')
      } else if (line.type === 'Conflict') {
        // Add double arrow marker
        legendLine
          .attr('marker-start', 'url(#start-line-arrow)')
          .attr('marker-end', 'url(#end-line-arrow)')
      } else if (line.type === 'Lead-Lag') {
        // Add double arrow marker
        legendLine.attr('marker-end', 'url(#end-line-arrow)')
      }
    } else {
      currentY += 34
    }
  })
}

const zoomIn = () => {
  // scale.value += 0.1
  // drawMap()
  const svg = d3.select(svgRef.value);
  svg.transition().call(zoom.scaleBy, 1.2);
}

const zoomOut = () => {
  // scale.value = Math.max(0.1, scale.value - 0.1) // Prevent scale from going below 0.1
  // drawMap()
  const svg = d3.select(svgRef.value);
  svg.transition().call(zoom.scaleBy, 0.8);
}

const handleClickOutside = (event: MouseEvent) => {
  const contextMenuElement = document.querySelector('.context-menu')
  if (contextMenuElement && !contextMenuElement.contains(event.target as Node)) {
    hideContextMenu()
  }
}

onMounted(() => {
  drawMap()
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(() => props.data, drawMap, { deep: true })

// Helper function to wrap text with proper typing
function wrap(text: d3.Selection<d3.BaseType, unknown, d3.BaseType, unknown>, width: number) {
  text.each(function (this: d3.BaseType) {
    const textElement = d3.select(this)
    const words = textElement.text().split(/\s+/).reverse()
    const lines: string[] = []

    if (words.length < 8) {
      width = 80
    }

    // First, calculate how many lines we'll need
    let currentLine: string[] = []
    const tempSpan = textElement.append('tspan').style('visibility', 'hidden')

    words
      .slice()
      .reverse()
      .forEach((word: string) => {
        currentLine.push(word)
        tempSpan.text(currentLine.join(' '))
        if (tempSpan.node()?.getComputedTextLength() > width) {
          currentLine.pop()
          if (currentLine.length) lines.push(currentLine.join(' '))
          currentLine = [word]
        }
      })
    if (currentLine.length) lines.push(currentLine.join(' '))
    tempSpan.remove()

    // Calculate starting position
    const lineHeight = 1.2
    const totalHeight = lines.length * lineHeight
    const startY = -totalHeight / 2 + lineHeight / 2

    // Clear existing text
    textElement.text('')

    // Add lines with proper spacing
    lines.forEach((line, i) => {
      textElement
        .append('tspan')
        .attr('x', 0)
        .attr('y', 0)
        .attr('dy', `${startY + i * lineHeight}em`)
        .text(line)
    })
  })
}
</script>

<template>
  <div ref="containerRef" class="svg-container">
    <svg ref="svgRef" :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="xMidYMid meet">
      <!-- SVG content goes here -->
       <g>

       </g>
    </svg>

    <div class="zoom-controls">
      <el-button @click="zoomIn" icon="Plus"></el-button>
      <el-button @click="zoomOut" icon="Minus"></el-button>
    </div>
  </div>

  <div
    v-if="contextMenuVisible"
    :style="{ top: `${contextMenuPosition.y}px`, left: `${contextMenuPosition.x}px` }"
    class="context-menu"
  >
    <!-- <h4>Bubble</h4> -->
    <el-form @submit.prevent="updateBubbleText">
      <el-form-item label="Text">
        <el-input v-model="newText" type="text" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="updateBubbleText">Update</el-button>
        <el-popconfirm title="Are you sure to remove this?" @confirm="confirmRemoveBubble">
          <template #reference>
            <el-button type="danger">Remove</el-button>
          </template>
        </el-popconfirm>
      </el-form-item>
    </el-form>
    <div v-if="selectedBubble">
      <h4
        v-if="
          props.data.relationships.filter(
            (rel) => rel.source === selectedBubble.id || rel.target === selectedBubble.id,
          ).length
        "
      >
        Relationships
      </h4>
      <ul>
        <li
          v-for="relationship in props.data.relationships.filter(
            (rel) => rel.source === selectedBubble.id || rel.target === selectedBubble.id,
          )"
          :key="relationship.id"
        >
          <span
            >[
            {{ props.data.bubbles.find((b) => b.id === relationship.target)?.text || '' }} ]</span
          >
          <el-select
            v-model="relationship.type"
            placeholder="Select"
            @change="(newType: string) => updateRelationshipType(relationship, newType)"
          >
            <el-option
              v-for="type in relationshipTypes"
              :key="type"
              :label="type"
              :value="type"
            ></el-option>
          </el-select>
          <el-button type="danger" @click="() => removeRelationship(relationship)"
            >Delete</el-button
          >
        </li>
      </ul>
    </div>
  </div>
</template>
<style scoped>
.svg-container {
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
}

svg {
  width: 100%;
  height: 100%;
}

.zoom-controls {
  position: fixed;
  top: 20px;
  right: 40px;
  display: flex;
  flex-direction: column;
}

.zoom-controls button {
  background-color: #fff;
  border: 1px solid #ccc;
  padding: 5px;
  margin: 2px 0;
  cursor: pointer;
}

.context-menu {
  position: absolute;
  background-color: white;
  border: 1px solid #ccc;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  padding: 20px 10px 10px;
}

.context-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.context-menu li {
  padding: 8px 12px;
  cursor: pointer;
}

.context-menu li:hover {
  background-color: #f0f0f0;
}

.context-menu form {
  display: flex;
  flex-direction: column;
}

.context-menu label {
  margin-bottom: 10px;
}

.context-menu button {
  margin-top: 5px;
}
</style>
