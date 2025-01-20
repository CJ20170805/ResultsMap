<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import type { ResultsMapData, Bubble, Relationship, Group, LayerType } from '@/types/ResultsMap'

const props = defineProps<{
  data: ResultsMapData
}>()

const svgRef = ref<SVGElement | null>(null)
const width = 1200
const height = 1100
const centerX = width / 2 + 50
const centerY = height / 2 + 0
const yScale = 0.9;
const yOffset = 50;

// Define track boundaries with inner and outer radii
const tracks = {
  mission: { outer: 110, inner: 0 }, // Pink (innermost)
  strategic: { outer: 240, inner: 110 }, // Green
  process: { outer: 370, inner: 240 }, // Blue
  operational: { outer: 490, inner: 370 }, // Orange (outermost)
}

// Calculate the middle radius for bubble positioning
const layerRadii = {
  mission: (tracks.mission.outer + tracks.mission.inner) / 2,
  strategic: (tracks.strategic.outer + tracks.strategic.inner) / 2,
  process: (tracks.process.outer + tracks.process.inner) / 2,
  operational: (tracks.operational.outer + tracks.operational.inner) / 2,
}

// Layer colors
const layerColors = {
  mission: '#ffcdd2', // Pink
  strategic: '#c8e6c9', // Green
  process: '#bbdefb', // Blue
  operational: '#ffe0b2', // Orange
}

// Add function to calculate group angles
function calculateGroupAngles(groups: Group[], bubbles: Bubble[]) {
  const totalAngle = 2 * Math.PI
  const groupedBubbles = bubbles.filter((b) => b.groupId !== '')
  const ungroupedBubbles = bubbles.filter((b) => b.groupId === '')

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
  startLayer: LayerType = 'process' as LayerType,
) {
  if (groups.length <= 1) return
  const dividerGroup = svg.append('g').attr('class', 'group-dividers')

  groups.forEach((group) => {
    if (group.startAngle !== undefined && group.endAngle !== undefined) {
      let startX, startY

      if (startLayer === 'mission') {
        // Start from the center if the startLayer is mission
        startX = centerX
        startY = centerY
      } else {
        // Start from the middle of the specified startLayer
        startX = centerX + Math.cos(group.startAngle) * tracks[startLayer].inner
        startY = centerY + yOffset + Math.sin(group.startAngle) * tracks[startLayer].inner  * yScale
      }
      const endX = centerX + Math.cos(group.startAngle) * tracks.operational.outer
      const endY = centerY + yOffset + Math.sin(group.startAngle) * tracks.operational.outer  * yScale

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
  groups.forEach((group) => {
    if (group.startAngle !== undefined && group.endAngle !== undefined) {
      const angle = (group.startAngle + group.endAngle) / 2
      const radius = tracks['operational'].outer + 20 // Offset
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
        .style('font-size', '14px')
        .style('fill', '#000')
    }
  })
}

const drawMap = () => {
  console.log('Map Data', props.data)
  if (!svgRef.value) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

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
svg.append('defs').append('marker')
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
  .attr('stroke-width', 1.5);

// Define end line arrow marker
svg.append('defs').append('marker')
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
  .attr('stroke-width', 1.5);

  // Add title at the top of the map
    svg.append('text')
    .attr('x', '50%')
    .attr('y', 100)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .text(props.data.mapConfig.title)
    .style('font-weight', 'bold')
    .style('font-size', `${props.data.mapConfig.fontSize}px`)
    .style('fill', '#000');

  // Calculate group angles
  const updatedGroups = calculateGroupAngles(props.data.groups, props.data.bubbles)
  // Draw layers (concentric circles)
  Object.entries(tracks)
    .reverse()
    .forEach(([layer, radii]) => {
      svg
        .append('ellipse')
        .attr('cx', centerX)
        .attr('cy', centerY + yOffset)
        .attr('rx', radii.outer)
        .attr('ry', radii.outer * yScale)
        .attr('fill', layerColors[layer as keyof typeof layerColors])
        .attr('opacity', 0.3)
    })

  // Draw group dividers with configurable starting layer
  drawGroupDividers(svg, updatedGroups, props.data.groupLevel) // Start from the center if the startLayer is mission

  // Position bubbles along their orbits
  props.data.bubbles.forEach((bubble, i) => {
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
    const radius = layerRadii[bubble.layer]
    bubble.x = centerX + radius * Math.cos(angle)
    bubble.y = centerY + + yOffset + radius * Math.sin(angle) * yScale
  })

  // Add group names
  addGroupNames(svg, updatedGroups)

  // Constants for bubble sizing
  const BUBBLE_RADIUS = 55
  const BUBBLE_RADIUS_X = 55;
  const BUBBLE_RADIUS_Y = 45
  const OFFSET = 3 // Adjust this value to control how far outside the bubbles the lines should start/end
  const TEXT_WIDTH = 80

  // Draw relationships
  const linkGroup = svg.append('g')
  props.data.relationships.forEach((rel) => {
    const source = props.data.bubbles.find((b) => b.id === rel.source)
    const target = props.data.bubbles.find((b) => b.id === rel.target)

    if (!source || !target) return

    // Calculate direction vector
    if (
      target.x === undefined ||
      source.x === undefined ||
      target.y === undefined ||
      source.y === undefined
    )
      return

    const dx = target.x - source.x
    const dy = target.y - source.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const unitX = dx / distance
    const unitY = dy / distance

    // Adjust start and end points based on bubble radius and offset
    const startX = source.x + unitX * (BUBBLE_RADIUS + OFFSET)
    const startY = source.y + unitY * (BUBBLE_RADIUS + OFFSET) * yScale
    const endX = target.x - unitX * (BUBBLE_RADIUS + OFFSET)
    const endY = target.y - unitY * (BUBBLE_RADIUS + OFFSET) * yScale

    // Calculate control point for quadratic Bézier curve
    const controlX = (startX + endX) / 2 + unitY * 50 // Adjust 50 for curve intensity
    const controlY = (startY + endY) / 2 - unitX * 50 // Adjust 50 for curve intensity

    const line = linkGroup
      .append('path')
      .attr('d', `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`)
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')

    console.log('rel.type', rel.type)

    if (rel.type === 'cause-effect') {
      // Add arrow marker
      line.attr('marker-end', 'url(#arrow)')
    } else if (rel.type === 'companion') {
      // Add circles at both ends
      line.attr('marker-start', 'url(#dot)').attr('marker-end', 'url(#dot)')
    } else if (rel.type === 'conflict') {
      // Add double arrow marker
      line.attr('marker-start', 'url(#start-line-arrow)').attr('marker-end', 'url(#end-line-arrow)')
    } else if (line.text === 'Lead-Lag') {
      // Add double arrow marker
      line.attr('marker-end', 'url(#end-line-arrow)');
    }
  })

  // Draw bubbles
  const bubbleGroup = svg.append('g')
  props.data.bubbles.forEach((bubble) => {
    const g = bubbleGroup.append('g').attr('transform', `translate(${bubble.x},${bubble.y})`)

    g.append('ellipse')
      .attr('rx', BUBBLE_RADIUS_X)
      .attr('ry', BUBBLE_RADIUS_Y) // Apply vertical scaling
      .attr('fill', layerColors[bubble.layer as keyof typeof layerColors])
      .attr('opacity', 0.8);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('fill', '#000')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(bubble.text)
      .attr('width', TEXT_WIDTH)
      .call(wrap, TEXT_WIDTH);

  })


   // Add legend to the bottom-left corner
  const legendGroup = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(20, ${height - 500})`); // Adjust the position as needed

  // Add background rectangle for legend
  legendGroup.append('rect')
    .attr('x', -20)
    .attr('y', -20)
    .attr('width', 100)
    .attr('height', 460)
    .attr('fill', '#f8f8f8')
    .attr('stroke', '#000')
    .attr('stroke-width', 0);

  // Add "Legend" text at the top
  legendGroup.append('text')
    .attr('x', 30)
    .attr('y', -4)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .text('Legend')
    .style('font-size', '13px')
    .style('font-weight', 'bold')
    .style('fill', '#000');

  // Add legend bubbles
  const legendBubbles = [
    { cx: 30, cy: 250, rx: 40, ry: 30, color: layerColors.operational, text: 'Operational' },
    { cx: 30, cy: 180, rx: 40, ry: 30, color: layerColors.process, text: 'Process' },
    { cx: 30, cy: 110, rx: 40, ry: 30, color: layerColors.strategic, text: 'Strategic' },
    { cx: 30, cy: 40, rx: 40, ry: 30, color: layerColors.mission, text: 'Mission' }
  ];

  legendBubbles.forEach((bubble, index) => {
    legendGroup.append('ellipse')
      .attr('cx', bubble.cx)
      .attr('cy', bubble.cy)
      .attr('rx', bubble.rx)
      .attr('ry', bubble.ry)
      .attr('fill', bubble.color);

    legendGroup.append('text')
      .attr('x', bubble.cx)
      .attr('y', bubble.cy)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .text(bubble.text)
      .style('font-size', '11px')
      .style('fill', '#000');

    if (index < legendBubbles.length - 1) {
      legendGroup.append('line')
        .attr('x1', bubble.cx)
        .attr('y1', bubble.cy - bubble.ry)
        .attr('x2', bubble.cx)
        .attr('y2', legendBubbles[index + 1].cy + legendBubbles[index + 1].ry + 1)
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5)
        .attr('marker-end', 'url(#arrow)');
    }
  });


   // Add vertical legend lines with text at the top
   const legendLines = [
    { x: 30, y: 310, length: 30, color: '#666', text: 'Cause-Effect' },
    { x: 30, y: 344, length: 30, color: '#666', text: 'Conflict' },
    { x: 30, y: 378, length: 30, color: '#666', text: 'Companion' },
    { x: 30, y: 412, length: 30, color: '#666', text: 'Lead-Lag' },
  ];

  legendLines.forEach((line) => {
    legendGroup.append('text')
      .attr('x', line.x)
      .attr('y', line.y)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .text(line.text)
      .style('font-size', '12px')
      .style('fill', '#000');

      const legendLine = legendGroup.append('line')
      .attr('x1', line.x - line.length)
      .attr('y1', line.y + 12)
      .attr('x2', line.x + line.length)
      .attr('y2', line.y + 12)
      .attr('stroke', line.color)
      .attr('stroke-width', 1.5);



      if (line.text === 'Cause-Effect') {
      // Add arrow marker
      legendLine.attr('marker-end', 'url(#arrow)');
    } else if (line.text === 'Companion') {
      // Add circles at both ends
      legendLine.attr('marker-start', 'url(#dot)').attr('marker-end', 'url(#dot)');
    } else if (line.text === 'Conflict') {
      // Add double arrow marker
      legendLine.attr('marker-start', 'url(#start-line-arrow)').attr('marker-end', 'url(#end-line-arrow)');
    } else if (line.text === 'Lead-Lag') {
      // Add double arrow marker
      legendLine.attr('marker-end', 'url(#end-line-arrow)');
    }
  });
}


// Helper function to wrap text with proper typing
function wrap(text: d3.Selection<d3.BaseType, unknown, d3.BaseType, unknown>, width: number) {
  text.each(function (this: d3.BaseType) {
    const textElement = d3.select(this)
    const words = textElement.text().split(/\s+/).reverse()
    const lines: string[] = []

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

onMounted(() => {
  drawMap()
})

watch(() => props.data, drawMap, { deep: true })
</script>

<template>
  <svg ref="svgRef" :width="width" :height="height">
    <!-- <defs>
      <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#666" />
      </marker>
      <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
        <circle cx="5" cy="5" r="4" fill="#666" />
      </marker>
    </defs> -->
  </svg>
</template>
