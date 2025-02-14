<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue'
import * as d3 from 'd3'
import type {
  ResultsMapData,
  Bubble,
  Relationship,
  Group,
  LayerType,
  LayerColors,
  RelationType,
} from '@/types/ResultsMap'

const props = defineProps<{
  data: ResultsMapData
  onAddGroup: (group: Omit<Group, 'id'>) => void
}>()

const svgRef = ref<SVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const width = 1200
const height = 1100
const centerX = width / 2 + 50
const centerY = height / 2 - 40
const yScale = 0.9
const yOffset = 50

const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedBubble = ref<Bubble | null>(null)
const newText = ref('')
const mapRelationships = ref(props.data.relationships)
const mapBubbles = ref(props.data.bubbles)
const mapGroups = ref(props.data.groups)

// handle empty click
const emptyPositionContextMenuVisible = ref(false)
const emptyPositionContextMenuPosition = ref({ x: 0, y: 0 })
const newBubbleText = ref('')
const newBubbleGroup = ref('')
const newBubblePosition = ref({ x: 0, y: 0 })

let isDragging = false
let currentTransform: { x: number; y: number; k: number }

const relationshipTypes = ['cause-effect', 'companion', 'conflict', 'lead-lag']

// Initialize zoom behavior
const zoom = d3
  .zoom<SVGElement, unknown>()
  .scaleExtent([0.1, 10]) // Set minimum and maximum zoom scale
  .on('zoom', (event) => {
    //console.log('onZoom...', event)
    hideContextMenu()

    currentTransform = event.transform

    if (!isDragging) {
      // Apply the zoom transformation to the SVG
      d3.select(svgRef.value).select('g').attr('transform', event.transform)
    }
  })

// Attach zoom behavior to the SVG
// const svg = d3.select(svgRef.value).call(zoom);

// Handle empty right-click
const handleEmptyPositionRightClick = (event: MouseEvent) => {
  // Get raw click position
  const [rawX, rawY] = d3.pointer(event, svgRef.value!)

  // Use currentTransform or fallback to identity transform
  const transform = currentTransform || { x: 0, y: 0, k: 1 }

  // Invert zoom transformation
  const invertedX = (rawX - transform.x) / transform.k
  const invertedY = (rawY - transform.y) / transform.k

  // Check if the click is on a bubble node
  const target = event.target as SVGElement
  const isBubbleNode = target.closest('g')?.classList.contains('bubble-group') // Add a class to bubble groups

  if (isBubbleNode) {
    // Find the clicked bubble
    const bubbleId = target.closest('g')?.getAttribute('data-bubble-id')
    const clickedBubble = props.data.bubbles.find((bubble) => bubble.id === bubbleId)

    if (clickedBubble) {
      // Show the bubble context menu
      showContextMenu(event, clickedBubble)
    }
  } else if (isPointWithinLayers(invertedX, invertedY)) {
    hideContextMenu()

    // Detect the group at the clicked position
    const groupId = detectGroup(invertedX, invertedY)
    currentGroup.value = props.data.groups.find((group) => group.id === groupId) || null

    // Set the empty position context menu position initially
    newBubblePosition.value = { x: invertedX, y: invertedY }
    emptyPositionContextMenuPosition.value = { x: event.clientX, y: event.clientY }
    emptyPositionContextMenuVisible.value = true

    // Use nextTick to ensure the context menu is rendered before calculating its height
    nextTick(() => {
      const emptyContextMenuElement = document.querySelector('.empty-context-menu') as HTMLElement
      if (emptyContextMenuElement) {
        const contextMenuHeight = Math.min(emptyContextMenuElement.clientHeight, 350)
        const contextMenuWidth = emptyContextMenuElement.clientWidth + 80

        // Get the viewport dimensions
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        // Calculate the adjusted position
        let x = event.clientX
        let y = event.clientY

        // Adjust the position if the context menu would go off the right edge of the screen
        if (x + contextMenuWidth > viewportWidth) {
          x = viewportWidth - contextMenuWidth
        }

        // Adjust the position if the context menu would go off the bottom edge of the screen
        if (y + contextMenuHeight > viewportHeight) {
          y = viewportHeight - contextMenuHeight
        }

        // Update the empty position context menu position
        emptyPositionContextMenuPosition.value = { x, y }
      }
    })
  }
}

const isPointWithinLayers = (x: number, y: number): boolean => {
  const dx = x - centerX
  const dy = (y - centerY - yOffset) / yScale // Adjust for y scaling and offset
  const distanceSquared = dx * dx + dy * dy

  // Check if the point is within the outermost layer
  const outermostRadius = tracks.operational.outer
  return distanceSquared <= outermostRadius * outermostRadius
}

// Helper function to detect the layer based on the position
const detectLayer = (x: number, y: number): LayerType => {
  // Adjust for y scaling and offset
  const dx = x - centerX
  const dy = (y - centerY - yOffset) / yScale

  // Calculate the elliptical distance for each layer
  const missionRadius = tracks.mission.outer
  if ((dx * dx) / missionRadius ** 2 + (dy * dy) / missionRadius ** 2 <= 1) {
    return 'mission'
  }

  const strategicRadius = tracks.strategic.outer
  if ((dx * dx) / strategicRadius ** 2 + (dy * dy) / strategicRadius ** 2 <= 1) {
    return 'strategic'
  }

  const processRadius = tracks.process.outer
  if ((dx * dx) / processRadius ** 2 + (dy * dy) / processRadius ** 2 <= 1) {
    return 'process'
  }

  return 'operational'
}

// Helper function to detect the group based on the position
const detectGroup = (x: number, y: number): string | null => {
  // Adjust for y scaling and offset
  const dx = x - centerX
  const dy = (y - centerY - yOffset) / yScale

  // Calculate angle in the scaled coordinate system (clockwise)
  const angle = Math.atan2(dy, dx)

  // Convert to anticlockwise order
  const anticlockwiseAngle = (2 * Math.PI - angle) % (2 * Math.PI)

  // console.log(`Click Position: x=${x}, y=${y}`)
  // console.log(`Adjusted Position: dx=${dx}, dy=${dy}`)
  // console.log(`Calculated Angle (clockwise): ${angle}`)
  // console.log(`Converted Angle (anticlockwise): ${anticlockwiseAngle}`)

  // Find the group that contains this angle
  const group = props.data.groups.find((group) => {
    if (group.startAngle === undefined || group.endAngle === undefined) return false
    return anticlockwiseAngle >= group.startAngle && anticlockwiseAngle <= group.endAngle
  })

  if (group) {
    console.log(`Detected Group: ${group.name}`)
  } else {
    console.log('No group detected')
  }

  return group ? group.id : null
}

// Handle create new bubble
const createBubble = () => {
  if (!newBubbleText.value) return

  // Detect the layer and group for the new bubble
  const layer = detectLayer(newBubblePosition.value.x, newBubblePosition.value.y)
  const groupId = detectGroup(newBubblePosition.value.x, newBubblePosition.value.y)

  console.log('CreateBubble: ', newBubbleText.value, layer, groupId)

  const newBubble: Bubble = {
    id: `bubble-${Date.now()}`, // Generate a unique ID
    text: newBubbleText.value,
    layer, // Automatically detected layer
    groupId: groupId || '', // Automatically detected group (or empty if no group)
    x: newBubblePosition.value.x,
    y: newBubblePosition.value.y,
    locked: false,
    visible: true,
  }

  mapBubbles.value.push(newBubble)
  //drawMap()

  // Reset form and hide context menu
  newBubbleText.value = ''
  emptyPositionContextMenuVisible.value = false
}

// Handle bubble right-click
const updateRelationshipType = (relationship: Relationship, newType: string) => {
  relationship.type = newType as Relationship['type']
  drawMap()
}

const removeRelationship = (relationship: Relationship) => {
  const index = props.data.relationships.findIndex((rel) => rel.id === relationship.id)
  if (index !== -1) {
    mapRelationships.value.splice(index, 1)
    drawMap()
  }
}

const showContextMenu = (event: MouseEvent, bubble: Bubble) => {
  hideContextMenu()
  event.preventDefault()
  selectedBubble.value = bubble
  newText.value = bubble.text

  // Set the context menu position initially
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true

  // Use nextTick to ensure the context menu is rendered before calculating its height
  nextTick(() => {
    const contextMenuElement = document.querySelector('.bubble-context-menu') as HTMLElement
    if (contextMenuElement) {
      const contextMenuHeight = contextMenuElement.clientHeight
      const contextMenuWidth = contextMenuElement.clientWidth + 50

      // Get the viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Calculate the adjusted position
      let x = event.clientX
      let y = event.clientY

      // Adjust the position if the context menu would go off the right edge of the screen
      if (x + contextMenuWidth > viewportWidth) {
        x = viewportWidth - contextMenuWidth
      }

      // Adjust the position if the context menu would go off the bottom edge of the screen
      if (y + contextMenuHeight > viewportHeight) {
        y = viewportHeight - contextMenuHeight
      }

      // Update the context menu position
      contextMenuPosition.value = { x, y }
    }
  })
}

const hideContextMenu = () => {
  contextMenuVisible.value = false
  selectedBubble.value = null

  emptyPositionContextMenuVisible.value = false
  newBubbleText.value = ''
  newBubbleGroup.value = ''
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
    const bubbleId = selectedBubble.value.id

    // Remove the bubble from the bubbles array
    const bubbleIndex = props.data.bubbles.findIndex((b) => b.id === bubbleId)
    if (bubbleIndex !== -1) {
      mapBubbles.value.splice(bubbleIndex, 1)
    }

    for (let i = mapRelationships.value.length - 1; i >= 0; i--) {
      const rel = mapRelationships.value[i]
      if (rel.source === bubbleId || rel.target === bubbleId) {
        mapRelationships.value.splice(i, 1) // Remove the relationship
      }
    }

    // Redraw the map and hide the context menu
    drawMap()
    hideContextMenu()
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
function calculateGroupAngles(groups: Group[]) {
  //, bubbles: Bubble[]
  // const totalAngle = 2 * Math.PI
  // const groupedBubbles = bubbles.filter((b) => b.groupId !== '')

  // // Calculate angles for groups
  // let currentAngle = 0
  // groups.forEach((group) => {
  //   const groupBubbles = groupedBubbles.filter((b) => b.groupId === group.id)
  //   const angleShare = (groupBubbles.length / bubbles.length) * totalAngle
  //   group.startAngle = currentAngle
  //   group.endAngle = currentAngle + angleShare
  //   currentAngle += angleShare
  // })

  const angleIncrement = (2 * Math.PI) / groups.length
  groups.forEach((group, index) => {
    if (!group.locked) {
      group.startAngle = index * angleIncrement
      group.endAngle = (index + 1) * angleIncrement
      console.log('GroupAngle- ' + group.name + ' : ', group.startAngle, group.endAngle)
    }
  })

  return groups
}

// Add function to draw group dividers
function drawGroupDividers(
  svg: d3.Selection<SVGGElement, unknown, null, undefined>,
  groups: Group[],
  startLayer: LayerType | 'None',
) {
  if (groups.length <= 1) return

  const dividerGroup = svg.append('g').attr('class', 'group-dividers')

  // Define the drag behavior
  const drag = d3
    .drag<SVGLineElement, Group>()
    .on('start', function () {
      d3.select(this).raise().attr('stroke', '#999')
    })
    .on('drag', function (event) {
      const [x, y] = d3.pointer(event, svgRef.value!)

      //Unlock every single bubble
      props.data.bubbles.forEach((b) => {
        b.locked = false
      })

      // Adjust Y coordinate for scaling/offset AND INVERT Y-AXIS
      const adjustedY = -(y - centerY - yOffset) / yScale // 🔥 Negate to fix coordinate system

      // Calculate angle with corrected y-axis
      const angle = Math.atan2(adjustedY, x - centerX) // Now uses inverted y
      const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle
      console.log('Angle===', angle)

      const MIN_ANGLE = 0.3

      const line = d3.select(this)
      let startX, startY

      const currentGroup = line.datum() as Group
      const currentIndex = groups.indexOf(currentGroup)
      const preGroup = currentIndex === 0 ? groups[groups.length - 1] : groups[currentIndex - 1]
      const nextGroup = groups[(currentIndex + 1) % groups.length]

      console.log('CurrentGroup: ', currentGroup, 'preGroup: ', preGroup)

      if (currentGroup && preGroup) {
        currentGroup.locked = true
        preGroup.locked = true

        currentGroup.isDragging = true
        preGroup.isDragging = true

        let clampedAngle = normalizedAngle
        console.log('currentIndex', currentIndex)

        // Disable drag for first group's divider
        if (currentIndex === 0) return
        // Prevent the first group and last group go to other side when they through the boundary divier
        if (
          (currentIndex === 1 && angle <= 0) ||
          (currentIndex === groups.length - 1 && angle >= 0)
        )
          return

        // For non-first groups, handle constraints
        const minBound = preGroup.startAngle! + MIN_ANGLE
        const maxBound =
          currentIndex === groups.length - 1
            ? currentGroup.endAngle! - MIN_ANGLE
            : nextGroup.startAngle! - MIN_ANGLE

        // Handle circular boundary wrap
        if (maxBound < minBound) {
          if (clampedAngle > maxBound && clampedAngle < minBound) {
            const distToMin = clampedAngle - maxBound
            const distToMax = minBound - clampedAngle
            clampedAngle = distToMin < distToMax ? maxBound : minBound
          }
        } else {
          clampedAngle = Math.max(minBound, Math.min(clampedAngle, maxBound))
        }

        // Final normalization
        clampedAngle = clampedAngle % (2 * Math.PI)
        if (clampedAngle < 0) clampedAngle += 2 * Math.PI

        // Update angles
        currentGroup.startAngle = clampedAngle
        preGroup.endAngle = clampedAngle

        if (startLayer === 'None') {
          startX = centerX
          startY = centerY
        } else {
          // Use original y-axis for drawing (SVG coordinates)
          startX = centerX + Math.cos(angle) * tracks[startLayer].inner
          startY = centerY + -Math.sin(angle) * tracks[startLayer].inner * yScale + yOffset
        }

        // End point (outer radius)
        const endX = centerX + Math.cos(angle) * tracks.operational.outer
        const endY = centerY + -Math.sin(angle) * tracks.operational.outer * yScale + yOffset

        line.attr('x1', startX).attr('y1', startY).attr('x2', endX).attr('y2', endY)
      }
    })
    .on('end', function () {
      d3.select(this).attr('stroke', 'white')

      const line = d3.select(this)

      const currentGroup = line.datum() as Group
      const currentIndex = groups.indexOf(currentGroup)
      const preGroup = currentIndex === 0 ? groups[groups.length - 1] : groups[currentIndex - 1]

      currentGroup.isDragging = false
      preGroup.isDragging = false
    })

  // Draw dividers
  groups.forEach((group, index) => {
    if (group.startAngle === undefined || group.endAngle === undefined) return
    if (startLayer === 'None') return

    // For first group, create a static line at 0
    if (index === 0) {
      const startX = centerX + Math.cos(0) * tracks[startLayer].inner
      const startY = centerY + -Math.sin(0) * tracks[startLayer].inner * yScale + yOffset

      const endX = centerX + Math.cos(0) * tracks.operational.outer
      const endY = centerY + -Math.sin(0) * tracks.operational.outer * yScale + yOffset

      dividerGroup
        .append('line')
        .attr('x1', startX)
        .attr('y1', startY)
        .attr('x2', endX)
        .attr('y2', endY)
        .attr('stroke', 'white')
        .attr('stroke-width', 3)
        .attr('cursor', 'default') // Disable resize cursor
        .datum(group)
    } else {
      // For other groups, create draggable lines
      const startX = centerX + Math.cos(group.startAngle) * tracks[startLayer].inner
      const startY =
        centerY + -Math.sin(group.startAngle) * tracks[startLayer].inner * yScale + yOffset

      const endX = centerX + Math.cos(group.startAngle) * tracks.operational.outer
      const endY =
        centerY + -Math.sin(group.startAngle) * tracks.operational.outer * yScale + yOffset

      dividerGroup
        .append('line')
        .attr('x1', startX)
        .attr('y1', startY)
        .attr('x2', endX)
        .attr('y2', endY)
        .attr('stroke', 'white')
        .attr('stroke-width', 3)
        .attr('cursor', 'ew-resize')
        .datum(group)
        .call(drag)
    }
  })
}

// Function to add group names
function addGroupNames(svg: d3.Selection<SVGGElement, unknown, null, undefined>, groups: Group[]) {
  console.log('GroupName--', groups)

  let initX: number, initY: number
  let initMouseX: number, initialMouseY: number

  const drag = d3
    .drag<SVGTextElement, Group>()
    .on('start', function (event: d3.D3DragEvent<SVGTextElement, Group, unknown>, d: Group) {
      d3.select(this).raise().attr('stroke', 'black')

      const [x, y] = d3.pointer(event, svgRef.value!)

      if (d.x && d.y) {
        initX = d.x
        initY = d.y
      }

      initMouseX = x
      initialMouseY = y

      isDragging = true
    })
    .on(
      'drag',
      function (
        this: SVGTextElement,
        event: d3.D3DragEvent<SVGTextElement, unknown, unknown>,
        d: Group,
      ) {
        console.log('DDD', d)

        const [x, y] = d3.pointer(event, svgRef.value!)

        const deltaX = x - initMouseX
        const deltaY = y - initialMouseY

        const currentText = groups.find((group) => group.id === d.id)
        if (currentText) {
          currentText.x = initX + deltaX
          currentText.y = initY + deltaY
          d3.select(this).attr('x', x).attr('y', y)
        }
      },
    )
    .on('end', function () {
      d3.select(this).attr('stroke', null)
      isDragging = false
    })

  groups.forEach((group) => {
    if (group.startAngle === undefined || group.endAngle === undefined) return

    let x: number, y: number

    // console.log("group.isDragging?", group.isDragging);

    if (!group.x || !group.y || group.isDragging) {
      const midAngle = (group.startAngle + group.endAngle) / 2
      const outerRadius = tracks.operational.outer + 20 // Offset outside the outer track
      x = centerX + outerRadius * Math.cos(midAngle)
      y = centerY + yOffset + outerRadius * -Math.sin(midAngle) * yScale //  - Math.sin to set the anticlockwise order

      //console.log("AddGroupName--", midAngle, centerY, yOffset, outerRadius, Math.sin(midAngle) * yScale,group.name, group.x, group.y, "===", x, y);

      group.x = x
      group.y = y
    } else {
      x = group.x
      y = group.y
    }

    // Add text element
    const textElement = svg
      .append('text')
      .datum(group)
      .attr('x', x)
      .attr('y', y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text(group.name)
      .style('font-weight', 'bold')
      .style('font-size', '18px')
      .style('fill', '#000')

    if (!isPresentationMode.value) {
      textElement.style('cursor', 'move').call(drag)
    }
  })
}

// Add arrows and title
function addArrowsAndTitle(svg: d3.Selection<SVGGElement, unknown, null, undefined>) {
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

  // Add a timestamp at the bottom left corner
  svg
  .append('text')
  .attr('x', '-.5%')
  .attr('y', '97%')
  .attr('text-anchor', 'end')
  .attr('alignment-baseline', 'middle')
  .text(
    props.data.mapConfig.date
      ? new Date(`${props.data.mapConfig.date}T00:00:00`).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
  )
  .style('font-size', '16px')
  .style('fill', '#000');
}

const drawMap = () => {
  console.log('Map Data', props.data)
  if (!svgRef.value) return

  // Data saving
  localStorage.setItem('MapData', JSON.stringify(props.data))

  // const currentTransform = d3.zoomTransform(mapGroup.node());

  const svg = d3.select(svgRef.value).call(zoom)
  svg.selectAll('*').remove()

  // Create or select the <g> element for the map content
  let mapGroup: d3.Selection<SVGGElement, unknown, null, undefined> = svg.select('g.map-group')
  if (mapGroup.empty()) {
    mapGroup = svg.append('g').attr('class', 'map-group')
  }

  if (currentTransform) {
    // Reapply the saved zoom transformation
    mapGroup.attr(
      'transform',
      `translate(${currentTransform.x},${currentTransform.y}) scale(${currentTransform.k})`,
    )
  }

  // Apply scale transformation
  //svg.attr('transform', `scale(${scale.value})`)

  // Define arrows and title
  addArrowsAndTitle(mapGroup)

  // Calculate group angles
  const updatedGroups = calculateGroupAngles(props.data.groups)
  //, props.data.bubbles

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
    if (bubble.locked || !bubble.visible) return

    let angle: number

    if (bubble.groupId) {
      // Find the group this bubble belongs to
      const group = updatedGroups.find((g) => g.id === bubble.groupId)
      if (group && group.startAngle !== undefined && group.endAngle !== undefined) {
        // Get all bubbles in the group for the same orbit (layer)
        const groupBubbles = props.data.bubbles.filter(
          (b) => b.groupId === group.id && b.layer === bubble.layer,
        )

        const bubbleIndex = groupBubbles.findIndex((b) => b.id === bubble.id)

        // Calculate the angular range for the group
        const sectorStart = group.startAngle
        const sectorEnd = group.endAngle
        const sectorSize = sectorEnd - sectorStart

        // Calculate the angular step based on bubbles in the same orbit
        const angleStep = sectorSize / (groupBubbles.length + 1) // Leave padding at edges

        // Position the bubble within its orbit
        angle = sectorStart + angleStep * (bubbleIndex + 1)
      } else {
        // Fallback for undefined groups
        angle = (i * (2 * Math.PI)) / props.data.bubbles.length
      }
    } else {
      // Handle ungrouped bubbles
      if (bubble.layer === 'mission') {
        // Special logic for mission layer
        const ungroupedMissionBubbles = props.data.bubbles.filter(
          (b) => !b.groupId && b.layer === 'mission',
        )

        if (ungroupedMissionBubbles.length === 1) {
          // If there's only one bubble, position it at the center
          bubble.x = centerX
          bubble.y = centerY + yOffset
          return // Skip the rest of the loop for this bubble
        } else {
          // If there are multiple bubbles, distribute them evenly around the full circle
          const bubbleIndex = ungroupedMissionBubbles.findIndex((b) => b.id === bubble.id)
          angle = (bubbleIndex * (2 * Math.PI)) / ungroupedMissionBubbles.length
        }
      } else {
        // For other layers, use the existing logic
        const ungroupedBubbles = props.data.bubbles.filter((b) => !b.groupId)
        const bubbleIndex = ungroupedBubbles.findIndex((b) => b.id === bubble.id)

        angle = ((bubbleIndex + 1) * (2 * Math.PI)) / (ungroupedBubbles.length + 1)
      }
    }

    // Calculate the bubble's position using its orbit radius
    const radius = layerRadii[bubble.layer as keyof typeof layerRadii]
    bubble.x = centerX + radius * Math.cos(angle)
    bubble.y = centerY + yOffset + radius * -Math.sin(angle) * yScale
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
  const drag = d3
    .drag<SVGGElement, Bubble>()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended)

  props.data.bubbles.forEach((bubble) => {
    if (!bubble.visible) return

    const isRelated = focusedBubbleId.value
      ? getRelatedBubblesAndRelationships(focusedBubbleId.value).relatedBubbles.includes(bubble.id)
      : true

    const g = bubbleGroup
      .append('g')
      .datum(bubble) // Bind the bubble data to the element
      .attr('transform', `translate(${bubble.x},${bubble.y})`)
      .attr('class', 'bubble-group')
      .attr('data-bubble-id', bubble.id)
      .style('cursor', 'move')
      .on('contextmenu', (event: MouseEvent) => showContextMenu(event, bubble)) // Add right-click event
      .on('click', () => handleBubbleClick(bubble.id)) // Handle bubble click

    if (isPresentationMode.value) {
      g.classed('transparent', !!focusedBubbleId.value && !isRelated) // Apply transparency
        .classed('highlight', focusedBubbleId.value === bubble.id) // Highlight focused bubble
    } else {
      g.call(drag)
    }

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
    const textBBox = textElement.node()!.getBBox()
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
      .attr('opacity', 1)
      .lower()
  })

  let initX: number, initY: number
  let initMouseX: number, initialMouseY: number

  function dragstarted(
    this: SVGElement,
    event: d3.D3DragEvent<SVGTextElement, Bubble, unknown>,
    d: Bubble,
  ) {
    console.log('StartDrag: ', event.x, event.y)
    hideContextMenu()
    //handleBubbleClick(d.id) // Set the target bubble

    // Check if the click is on the isCreatingRelationship mode, then create a relationship
    if (isCreatingRelationship.value) {
      handleBubbleClick(d.id)
    }

    d3.select(svgRef.value).on('.zoom', null) // Remove zoom event listeners

    const [x, y] = d3.pointer(event, svgRef.value!)

    if (d.x && d.y) {
      initX = d.x
      initY = d.y
    }

    initMouseX = x
    initialMouseY = y

    isDragging = true

    // d3.select(this).raise().classed('active', true)
    d3.select(this).raise().attr('stroke', 'black')
  }

  function dragged(event: d3.D3DragEvent<SVGTextElement, unknown, unknown>, d: Bubble) {
    console.log('Dragged: ', event, d)
    const [x, y] = d3.pointer(event, svgRef.value!)

    // d3.select(this).attr('transform', `translate(${event.x},${event.y})`)

    const deltaX = x - initMouseX
    const deltaY = y - initialMouseY

    // Update the position of the dragged bubble
    const bubble = props.data.bubbles.find((b) => b.id === d.id)
    if (bubble) {
      bubble.x = initX + deltaX
      bubble.y = initY + deltaY
      bubble.locked = true

      //d3.select(this).attr('transform', `translate(${bubble.x},${bubble.y})`)
    }

    // Update the paths dynamically
    //updateRelationships();
  }

  function dragended(this: SVGGElement) {
    d3.select(svgRef.value!).call(zoom) // Reapply zoom behavior
    isDragging = false // Reset dragging flag
    d3.select(this).attr('stroke', null)
  }

  // Draw relationships
  const linkGroup = mapGroup.append('g')
  props.data.relationships.forEach((rel) => {
    const source = props.data.bubbles.find((b) => b.id === rel.source)
    const target = props.data.bubbles.find((b) => b.id === rel.target)

    if (
      !source ||
      !target ||
      !target.x ||
      !target.y ||
      !source.x ||
      !source.y ||
      !source.visible ||
      !target.visible
    )
      return

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

    // Use a straight line for close bubbles
    const CLOSE_DISTANCE_THRESHOLD = 240
    // console.log('distance', distance)

    if (distance < CLOSE_DISTANCE_THRESHOLD) {
      const line = linkGroup
        .append('line')
        .attr('data-relationship-id', rel.id) // Add a unique identifier
        .attr('x1', startX)
        .attr('y1', startY)
        .attr('x2', endX)
        .attr('y2', endY)
        .attr('stroke', '#666')
        .attr('stroke-width', 1.5)
        .attr('fill', 'none')

      if (rel.type === 'cause-effect') {
        line.attr('marker-end', 'url(#arrow)')
      } else if (rel.type === 'companion') {
        line.attr('marker-start', 'url(#dot)').attr('marker-end', 'url(#dot)')
      } else if (rel.type === 'conflict') {
        line
          .attr('marker-start', 'url(#start-line-arrow)')
          .attr('marker-end', 'url(#end-line-arrow)')
      } else if (rel.type === 'lead-lag') {
        line.attr('marker-end', 'url(#end-line-arrow)')
      }
    } else {
      let controlX = (startX + endX) / 2 + unitY * 50
      let controlY = (startY + endY) / 2 - unitX * 50

      // Check for collisions with other bubbles
      const closestBubble = ref<Bubble | null>(null)
      let minDistance = Infinity

      props.data.bubbles.forEach((b) => {
        if (b.id === source.id || b.id === target.id || !b.x || !b.y) return

        const radius = bubbleRadii.get(b.id)
        if (!radius) return

        if (lineIntersectsEllipse(startX, startY, endX, endY, b.x, b.y, radius.rx, radius.ry)) {
          const midX = (startX + endX) / 2
          const midY = (startY + endY) / 2
          const dx = midX - b.x
          const dy = midY - b.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < minDistance) {
            minDistance = distance
            closestBubble.value = b
          }
        }
      })

      if (closestBubble.value && closestBubble.value.x && closestBubble.value.y) {
        const perpX = -unitY
        const perpY = unitX

        const lineVecX = endX - startX
        const lineVecY = endY - startY
        const cross =
          (closestBubble.value.x - startX) * lineVecY - (closestBubble.value.y - startY) * lineVecX
        const sign = cross > 0 ? 1 : -1

        // Get the radius of the closest bubble
        const closestRadius = bubbleRadii.get(closestBubble.value.id)
        if (!closestRadius) return

        // Calculate shift distance based on bubble size + padding
        const shiftX = closestRadius.rx + OFFSET
        const shiftY = closestRadius.ry + OFFSET

        // Adjust control points proportionally to bubble size
        controlX += sign * perpX * (shiftX * 1.2) // 1.5x for clearance
        controlY += sign * perpY * (shiftY * 1.5)
      }

      const line = linkGroup
        .append('path')
        .attr('data-relationship-id', rel.id) // Add a unique identifier
        .attr('d', `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`)
        .attr('stroke', '#666')
        .attr('stroke-width', 1.5)
        .attr('fill', 'none')

      if (rel.type === 'cause-effect') {
        line.attr('marker-end', 'url(#arrow)')
      } else if (rel.type === 'companion') {
        line.attr('marker-start', 'url(#dot)').attr('marker-end', 'url(#dot)')
      } else if (rel.type === 'conflict') {
        line
          .attr('marker-start', 'url(#start-line-arrow)')
          .attr('marker-end', 'url(#end-line-arrow)')
      } else if (rel.type === 'lead-lag') {
        line.attr('marker-end', 'url(#end-line-arrow)')
      }
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
  const svg = d3.select(svgRef.value!)
  svg.transition().call(zoom.scaleBy, 1.2)
}

const zoomOut = () => {
  // scale.value = Math.max(0.1, scale.value - 0.1) // Prevent scale from going below 0.1
  // drawMap()
  const svg = d3.select(svgRef.value!)
  svg.transition().call(zoom.scaleBy, 0.8)
}

const resetZoom = () => {
  const svg = d3.select(svgRef.value!)
  svg.transition().call(zoom.transform, d3.zoomIdentity)
}

// Create a new relationship
const newRelationship = ref({
  source: '',
  target: '',
  type: 'cause-effect' as RelationType,
})

const newRelationshipType = ref<RelationType>('cause-effect')

const isCreatingRelationship = ref(false)

const startCreateRelationship = (type: RelationType) => {
  if (selectedBubble.value) {
    console.log('Start Create Relationship', selectedBubble.value)

    // Apply transparency to the selected bubble
    const selectedBubbleElement = document.querySelector(
      `[data-bubble-id="${selectedBubble.value.id}"]`,
    )
    if (selectedBubbleElement) {
      selectedBubbleElement.classList.add('transparent')
    }

    newRelationship.value.source = selectedBubble.value.id
    newRelationship.value.type = type
    contextMenuVisible.value = false // Hide the context menu

    // Enter a mode where the next bubble click will be the target
    isCreatingRelationship.value = true
  }
}

const handleAddRelationship = () => {
  if (newRelationship.value.source && newRelationship.value.target) {
    console.log('Add Relationship', newRelationship.value)

    mapRelationships.value.push({
      id: Date.now().toString(),
      source: newRelationship.value.source,
      target: newRelationship.value.target,
      type: newRelationship.value.type,
    })

    // Remove the .transparent class and re-enable clicks on the source bubble
    const sourceBubbleElement = document.querySelector(
      `[data-bubble-id="${newRelationship.value.source}"]`,
    )
    if (sourceBubbleElement) {
      sourceBubbleElement.classList.remove('transparent')
    }

    newRelationship.value.source = ''
    newRelationship.value.target = ''
  }
}

// Create a new group
const newGroupName = ref<string>('')
const currentGroup = ref<Group | null>(null)

const createGroup = () => {
  // if (!newGroupName.value) return;
  props.onAddGroup({
    name: newGroupName.value,
    locked: false,
    isDragging: false,
  })

  // Clear the input field and hide the context menu
  newGroupName.value = ''
  emptyPositionContextMenuVisible.value = false
}

const deleteCurrentGroup = () => {
  if (currentGroup.value) {
    // Remove the group from the groups array
    const groupIndex = mapGroups.value.findIndex((group) => group.id === currentGroup.value?.id)
    if (groupIndex !== -1) {
      mapGroups.value.splice(groupIndex, 1) // Remove the group using splice
    }

    // Remove all bubbles associated with the group
    for (let i = mapBubbles.value.length - 1; i >= 0; i--) {
      if (mapBubbles.value[i].groupId === currentGroup.value?.id) {
        mapBubbles.value.splice(i, 1) // Remove the bubble using splice
      }
    }

    // Remove all relationships associated with the group's bubbles
    const groupBubbleIds = mapBubbles.value
      .filter((bubble) => bubble.groupId === currentGroup.value?.id)
      .map((bubble) => bubble.id)

    for (let i = mapRelationships.value.length - 1; i >= 0; i--) {
      const rel = mapRelationships.value[i]
      if (groupBubbleIds.includes(rel.source) || groupBubbleIds.includes(rel.target)) {
        mapRelationships.value.splice(i, 1) // Remove the relationship using splice
      }
    }

    // Clear the current group and hide the context menu
    currentGroup.value = null
    emptyPositionContextMenuVisible.value = false

    // Redraw the map to reflect the changes
    drawMap()
  }
}

// presentation mode functions
// Define layers from outermost to innermost
const layers = ['operational', 'process', 'strategic', 'mission']
const currentLayerIndex = ref(0) // Start with the outermost layer
const selectedGroup = ref('all')
const isPresentationMode = ref(false)
const showControls = ref(false)

const currentLayer = computed(() => layers[currentLayerIndex.value])

const togglePresentationMode = () => {
  isPresentationMode.value = !isPresentationMode.value
  if (isPresentationMode.value) {
    enterFullscreen()
  } else {
    exitFullscreen()
  }
}

const handlePresentationMouseEnter = () => {
  if (isPresentationMode.value) {
    showControls.value = true
  }
}
const handlePresentationMouseLeave = () => {
  if (isPresentationMode.value) {
    showControls.value = false
  }
}

// const toggleLayerControls = () => {
//   showLayerControls.value = !showLayerControls.value;
// };

const switchToNextLayer = () => {
  currentLayerIndex.value = (currentLayerIndex.value + 1) % layers.length
  updateBubbleVisibility()
}

const switchToPreviousLayer = () => {
  currentLayerIndex.value = (currentLayerIndex.value - 1 + layers.length) % layers.length
  updateBubbleVisibility()
}

const updateBubbleVisibility = () => {
  const selectedLayerIndex = layers.indexOf(currentLayer.value)

  // Update bubble visibility based on the selected layer
  props.data.bubbles.forEach((bubble) => {
    const bubbleLayerIndex = layers.indexOf(bubble.layer)
    const isInSelectedGroup =
      selectedGroup.value === 'all' || bubble.groupId === selectedGroup.value
    bubble.visible =
      (bubbleLayerIndex >= selectedLayerIndex && isInSelectedGroup) || bubble.layer === 'mission' // Show bubbles from mission to the selected layer
  })
}

const updateGroupVisibility = () => {
  updateBubbleVisibility() // Update visibility when the group selection changes
}

const enterFullscreen = () => {
  const container = containerRef.value
  if (container) {
    if (container.requestFullscreen) {
      container.requestFullscreen()
    } else if ((container as any).webkitRequestFullscreen) {
      // Safari support
      ;(container as any).webkitRequestFullscreen()
    } else if ((container as any).msRequestFullscreen) {
      // IE/Edge support
      ;(container as any).msRequestFullscreen()
    }
  }
}

const exitFullscreen = () => {
  if (document.exitFullscreen) {
    document.exitFullscreen()
  } else if ((document as any).webkitExitFullscreen) {
    // Safari support
    ;(document as any).webkitExitFullscreen()
  } else if ((document as any).msExitFullscreen) {
    // IE/Edge support
    ;(document as any).msExitFullscreen()
  }
}

const handleFullscreenChange = () => {
  isPresentationMode.value = !!document.fullscreenElement
  resetView()
}

// Reset layer and group selection to default values
const resetView = () => {
  resetZoom()
  focusedBubbleId.value = null
  currentLayerIndex.value = 0 // Reset to the outermost layer
  selectedGroup.value = 'all' // Reset to "All" groups
  updateBubbleVisibility() // Update visibility to show all bubbles and relationships
  drawMap()
}

// Bubble focus
const focusedBubbleId = ref<string | null>(null)

const handleBubbleClick = (bubbleId: string) => {
  console.log('clicked bubble', bubbleId)

  if (isCreatingRelationship.value) {
    if (bubbleId === newRelationship.value.source) {
      // Prevent creating a relationship with the same bubble
      console.log('Cannot create a relationship with the same bubble.')
      return
    }

    // Check if the relationship already exists
    const relationshipExists = mapRelationships.value.some(
      (rel) =>
        (rel.source === newRelationship.value.source && rel.target === bubbleId) ||
        (rel.source === bubbleId && rel.target === newRelationship.value.source),
    )

    if (relationshipExists) {
      console.log('A relationship between these bubbles already exists.')
      return // Return false if the relationship already exists
    }

    newRelationship.value.target = bubbleId
    handleAddRelationship()
    isCreatingRelationship.value = false // Exit relationship creation mode
  } else if (isPresentationMode.value) {
    if (focusedBubbleId.value === bubbleId) {
      // If the same bubble is clicked again, reset the focus
      focusedBubbleId.value = null
    } else {
      // Set the clicked bubble as the focused bubble
      focusedBubbleId.value = bubbleId
    }
  }

  drawMap()
}

const getRelatedBubblesAndRelationships = (bubbleId: string) => {
  const relatedBubbles = new Set<string>()
  const relatedRelationships = new Set<string>()

  const exploreRelationships = (currentBubbleId: string) => {
    props.data.relationships.forEach((rel) => {
      if (rel.source === currentBubbleId || rel.target === currentBubbleId) {
        if (!relatedRelationships.has(rel.id)) {
          relatedRelationships.add(rel.id)

          const otherBubbleId = rel.source === currentBubbleId ? rel.target : rel.source

          if (!relatedBubbles.has(otherBubbleId)) {
            relatedBubbles.add(otherBubbleId)
            exploreRelationships(otherBubbleId) // Recursively explore siblings
          }
        }
      }
    })
  }

  // Start exploration from the initial bubble
  relatedBubbles.add(bubbleId)
  exploreRelationships(bubbleId)

  return {
    relatedBubbles: Array.from(relatedBubbles),
    relatedRelationships: Array.from(relatedRelationships),
  }
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
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange) // Safari
  document.addEventListener('msfullscreenchange', handleFullscreenChange) // IE/Edge
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange) // Safari
  document.removeEventListener('msfullscreenchange', handleFullscreenChange) // IE/Edge
})

watch(() => props.data, drawMap, { deep: true })

// Helper function to wrap text with proper typing
function wrap(text: d3.Selection<SVGTextElement, Bubble, null, undefined>, width: number) {
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

        const node = tempSpan.node()
        if (node && node.getComputedTextLength() > width) {
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

// Helper: Check if line intersects an ellipse
function lineIntersectsEllipse(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  h: number,
  k: number,
  rx: number,
  ry: number,
): boolean {
  const dx = x2 - x1
  const dy = y2 - y1

  // Quadratic equation coefficients
  const A = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
  const B = 2 * ((dx * (x1 - h)) / (rx * rx) + (dy * (y1 - k)) / (ry * ry))
  const C = (x1 - h) ** 2 / (rx * rx) + (y1 - k) ** 2 / (ry * ry) - 1

  const discriminant = B * B - 4 * A * C
  if (discriminant < 0) return false

  const sqrtDisc = Math.sqrt(discriminant)
  const t1 = (-B + sqrtDisc) / (2 * A)
  const t2 = (-B - sqrtDisc) / (2 * A)

  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1)
}
</script>

<template>
  <div ref="containerRef" class="svg-container">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet"
      @contextmenu.prevent="handleEmptyPositionRightClick"
    >
      <g></g>
    </svg>

    <!-- presentation controls -->
    <div
      class="presentation-controls"
      :class="{ 'show-controls': showControls }"
      @mouseenter="handlePresentationMouseEnter"
      @mouseleave="handlePresentationMouseLeave"
    >
      <el-row :gutter="20" v-show="showControls">
        <el-col :span="7">
          <span style="margin: 0 10px 0 0">Layer: </span>
          <el-button @click="switchToPreviousLayer" icon="ArrowUp"></el-button>
          <span class="layer-label">{{ currentLayer }}</span>
          <el-button @click="switchToNextLayer" icon="ArrowDown"></el-button>
        </el-col>
        <el-col :span="7">
          <!-- Group selection dropdown -->
          <el-row>
            <el-col :span="5">
              <span style="margin: 0 10px 0 0; line-height: 30px">Group: </span>
            </el-col>
            <el-col :span="17">
              <!-- <el-select
                v-model="selectedGroup"
                placeholder="Select Group"
                @change="updateGroupVisibility"
                popper-append-to-body
              >
                <el-option label="All" value="all"></el-option>
                <el-option
                  v-for="group in props.data.groups"
                  :key="group.id"
                  :label="group.name"
                  :value="group.id"
                ></el-option>
              </el-select> -->
              <select v-model="selectedGroup" @change="updateGroupVisibility" class="custom-select">
                <option value="all">All</option>
                <option
                  v-for="(group, index) in props.data.groups"
                  :key="group.id"
                  :value="group.id"
                >
                  {{ group.name || `Group ${index + 1}` }}
                </option>
              </select>
            </el-col>
          </el-row>
        </el-col>
        <el-col :span="4">
          <el-button @click="resetView">Reset</el-button>
        </el-col>
      </el-row>
    </div>

    <!-- zoom controls -->
    <div class="zoom-controls">
      <el-button @click="zoomIn" icon="Plus"></el-button>
      <el-button @click="zoomOut" icon="Minus"></el-button>
      <el-button @click="resetZoom" icon="RefreshRight"></el-button>
      <el-button
        style="margin: 15px 0 0 0"
        @click="togglePresentationMode"
        :class="{ 'presentation-mode': isPresentationMode }"
        :icon="`${isPresentationMode ? 'Platform' : 'Monitor'}`"
      ></el-button>
    </div>
  </div>

  <!-- context menu for bubble updates -->
  <div
    v-if="contextMenuVisible"
    :style="{ top: `${contextMenuPosition.y}px`, left: `${contextMenuPosition.x}px` }"
    class="context-menu bubble-context-menu"
  >
    <el-divider> Bubble </el-divider>
    <!-- <h4>Bubble</h4> -->
    <el-form @submit.prevent="updateBubbleText" style="margin: 0 0 10px 0">
      <el-form-item label="">
        <el-input v-model="newText" type="text" />
      </el-form-item>
      <el-form-item class="margin-top-less">
        <el-button type="primary" style="width: 47%" @click="updateBubbleText">Update</el-button>
        <el-popconfirm title="Are you sure to remove this?" @confirm="confirmRemoveBubble">
          <template #reference>
            <el-button style="width: 47%" type="danger">Remove</el-button>
          </template>
        </el-popconfirm>
      </el-form-item>
    </el-form>

    <el-divider> Relationship </el-divider>
    <!-- Add a select box for relationship types -->
    <el-form-item label="">
      <el-select v-model="newRelationshipType" placeholder="Select relationship type">
        <el-option v-for="type in relationshipTypes" :key="type" :label="type" :value="type" />
      </el-select>
    </el-form-item>

    <!-- Add the "Create Relationship" button -->
    <el-button
      type="primary"
      class="margin-top-less"
      style="width: 100%; margin-top: 0px"
      @click="startCreateRelationship(newRelationshipType)"
      >Create Relationship</el-button
    >

    <div class="relationship-list" v-if="selectedBubble">
      <!-- <h4
        v-if="
          props.data.relationships.filter(
            (rel) => rel.source === selectedBubble?.id || rel.target === selectedBubble?.id,
          ).length
        "
      >
       &nbsp;  Relationships
      </h4> -->
      <ul>
        <li
          v-for="relationship in props.data.relationships
            .filter((rel) => rel.source === selectedBubble?.id || rel.target === selectedBubble?.id)
            .reverse()"
          :key="relationship.id"
        >
          <span class="text-ellipsis">
            <el-icon style="vertical-align: middle; margin-right: 2px"><Link /></el-icon>
            {{ props.data.bubbles.find((b) => b.id === relationship.target)?.text || '' }}</span
          >

          <el-row :gutter="10">
            <el-col :span="16">
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
            </el-col>
            <el-col :span="6">
              <el-button type="danger" @click="() => removeRelationship(relationship)"
                >Delete</el-button
              >
            </el-col>
          </el-row>
        </li>
      </ul>
    </div>
  </div>

  <!-- Context menu for empty positions -->
  <div
    v-if="emptyPositionContextMenuVisible"
    :style="{
      top: `${emptyPositionContextMenuPosition.y}px`,
      left: `${emptyPositionContextMenuPosition.x}px`,
    }"
    class="context-menu empty-context-menu"
  >
    <el-divider> Bubble </el-divider>
    <el-form @submit.prevent="createBubble">
      <el-form-item label="">
        <el-input v-model="newBubbleText" type="text" />
      </el-form-item>
      <el-form-item>
        <el-button
          class="margin-top-less"
          type="primary"
          style="width: 100%; margin-bottom: 10px"
          @click="createBubble"
          >Create</el-button
        >
      </el-form-item>
    </el-form>

    <el-divider> Group </el-divider>
    <el-form @submit.prevent="createGroup">
      <el-form-item label="">
        <el-input v-model="newGroupName" type="text" placeholder="Enter group name" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" class="margin-top-less" style="width: 100%" @click="createGroup"
          >Create Group</el-button
        >
      </el-form-item>

      <template v-if="currentGroup">
        <el-form-item label="">
          <el-input
            v-model="currentGroup.name"
            style="width: 100%; margin-top: 10px"
            type="text"
            placeholder="Enter group name"
          />
        </el-form-item>
      </template>

      <el-popconfirm
        :title="`Are you sure you want to delete the group '${currentGroup?.name}'' and all its bubbles?`"
        @confirm="deleteCurrentGroup"
      >
        <template #reference>
          <el-button v-if="currentGroup" type="danger" style="width: 100%; margin-top: 0px">
            Delete Current Group
          </el-button>
        </template>
      </el-popconfirm>
    </el-form>
  </div>
</template>
<style>
.transparent {
  opacity: 0.2;
  transition: opacity 0.2s ease;
}

.highlight {
  opacity: 1;
  stroke-width: 2px;
}
.el-divider--horizontal {
  margin: 10px 0 20px;
}
</style>
<style scoped>
.svg-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: #fff;
}

svg {
  width: 100%;
  height: 100%;
}

.margin-top-less {
  margin-top: -4px !important;
}

.text-ellipsis {
  display: inline-block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.presentation-controls {
  position: fixed;
  bottom: 0px;
  right: 0px;
  left: 0px;
  padding: 5px 0;
  border-radius: 8px;
  background-color: #fff;
  transition: all 0.2s;
}

.relationship-list {
  margin: 10px 0 0 0;
  overflow: hidden;
}

.relationship-list h4 {
  margin: 10px 0 0 0;
}

.relationship-list ul {
  list-style: none;
  padding: 0 0 50px 0;
  margin: 0;
  max-height: 270px;
  overflow-y: auto;
  overflow-x: hidden;
}

.custom-select {
  display: block;
  width: 100%;
  height: 30px;
  padding: 0 10px;
  font-size: 14px;
  line-height: 1.5;
  color: #606266; /* Element Plus text color */
  background-color: #fff; /* Element Plus background */
  background-image: none;
  border: 1px solid #dcdfe6; /* Element Plus border color */
  border-radius: 4px; /* Element Plus border radius */
  appearance: none; /* Remove native select arrow styling */
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
}

.custom-select:focus {
  outline: none;
  border-color: #409eff; /* Element Plus focus border color */
  box-shadow: 0 0 4px rgba(64, 158, 255, 0.5);
}

.custom-select:hover {
  border-color: #c6e2ff; /* Element Plus hover border color */
}

.custom-select option {
  color: #606266;
}

.show-controls {
  padding: 10px 80px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.layer-label {
  margin: 0 10px;
  font-size: 14px;
  font-weight: bold;
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
  width: 250px;
  position: absolute;
  background-color: white;
  border: 1px solid #ccc;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  padding: 10px 10px 10px;
}

.context-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.context-menu li {
  padding: 8px 8px;
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
  margin-top: 0px;
}
</style>
