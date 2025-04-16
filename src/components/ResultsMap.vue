<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick, inject } from 'vue'
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
import saveSvgAsPng from 'save-svg-as-png'
import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import { ElMessageBox, ElMessage } from 'element-plus'
import type { TourGuideClient } from '@sjmc11/tourguidejs/src/Tour'
import createGroupGif from '@/assets/gif/create-group.gif'
import createBubbleGif from '@/assets/gif/create-bubble.gif'
import createRelationshipGif from '@/assets/gif/create-relationship.gif'
import QuestionSvg from '@/assets/svg/question.svg'
import logoImage from '@/assets/logo.png'

const props = defineProps<{
  data: ResultsMapData
  onAddGroup: (group: Omit<Group, 'id'>) => void
  onResetDataToDefault: () => void
}>()

const svgRef = ref<SVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const width = 1800
const height = 1240
const centerX = width / 2 + 80
const centerY = height / 2 - 40
const yScale = 0.86
const yOffset = 50

const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedBubble = ref<Bubble | null>(null)
const newText = ref('')
const mapRelationships = ref(props.data.relationships)
const mapBubbles = ref(props.data.bubbles)
const mapGroups = ref(props.data.groups)
const mapConfig = ref(props.data.mapConfig)

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
    console.log('GroupIdRightClick--', groupId)

    currentGroup.value = props.data.groups.find((group) => group.id === groupId) || null

    // Set the empty position context menu position initially
    newBubblePosition.value = { x: invertedX, y: invertedY }
    emptyPositionContextMenuPosition.value = { x: event.clientX, y: event.clientY }
    emptyPositionContextMenuVisible.value = true

    // Use nextTick to ensure the context menu is rendered before calculating its height
    nextTick(() => {
      const emptyContextMenuElement = document.querySelector('.empty-context-menu') as HTMLElement
      if (emptyContextMenuElement) {
        const contextMenuHeight = Math.min(emptyContextMenuElement.clientHeight, 490)
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

        // start a context menu tour
        // messageInstance.close();
        hasSeenTour = localStorage.getItem('hasSeenTour')
        // && !isFirstBubbleCreated.value && !isFirstGroupCreated.value
        if (!hasSeenTour) {
          startCreationMenuTour()
        }
      }
    })
  }
}

const isPointWithinLayers = (x: number, y: number): boolean => {
  const dx = x - centerX
  const dy = (y - centerY - yOffset) / yScale // Adjust for y scaling and offset
  const distanceSquared = dx * dx + dy * dy

  // Check if the point is within the outermost layer
  const outermostRadius = tracks.value.operational.outer
  return distanceSquared <= outermostRadius * outermostRadius
}

// Helper function to detect the layer based on the position
const detectLayer = (x: number, y: number): LayerType => {
  // Adjust for y scaling and offset
  const dx = x - centerX
  const dy = (y - centerY - yOffset) / yScale

  // Calculate the elliptical distance for each layer
  const missionRadius = tracks.value.mission.outer
  if ((dx * dx) / missionRadius ** 2 + (dy * dy) / missionRadius ** 2 <= 1) {
    return 'mission'
  }

  const strategicRadius = tracks.value.strategic.outer
  if ((dx * dx) / strategicRadius ** 2 + (dy * dy) / strategicRadius ** 2 <= 1) {
    return 'strategic'
  }

  const processRadius = tracks.value.process.outer
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

  // Convert to anticlockwise order and normalize to [0, 2π)
  let anticlockwiseAngle = (2 * Math.PI - angle) % (2 * Math.PI)
  if (anticlockwiseAngle < 0) anticlockwiseAngle += 2 * Math.PI

  // Find the group that contains this angle
  const group = props.data.groups.find((group) => {
    if (group.startAngle === undefined || group.endAngle === undefined) return false

    // Normalize group angles to [0, 2π)
    let startAngle = group.startAngle < 0 ? group.startAngle + 2 * Math.PI : group.startAngle
    let endAngle = group.endAngle < 0 ? group.endAngle + 2 * Math.PI : group.endAngle

    // Handle wrap-around groups (where endAngle < startAngle)
    if (endAngle < startAngle) {
      return anticlockwiseAngle >= startAngle || anticlockwiseAngle <= endAngle
    }

    // Normal case
    return anticlockwiseAngle >= startAngle && anticlockwiseAngle <= endAngle
  })

  if (group) {
    console.log(
      `Detected Group: ${group.name} (${group.startAngle} to ${group.endAngle}) for angle ${anticlockwiseAngle}`,
    )
    return group.id
  } else {
    console.log(`No group detected for angle ${anticlockwiseAngle}`)
    return null
  }
}

// Handle create new bubble
const createBubble = () => {
  if (!newBubbleText.value) return

  // Check if there is one group on the map at least
  if (props.data.groups.length === 0) {
    ElMessage({
      message: 'Please create at least one group before adding bubbles.',
      type: 'warning',
    })
    return
  }

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
    fontColor: '#000',
    fontSize: 16,
    fontWeight: 'normal',
  }

  mapBubbles.value.push(newBubble)
  //drawMap()

  // Reset form and hide context menu
  newBubbleText.value = ''
  emptyPositionContextMenuVisible.value = false

  isFirstBubbleCreated.value = true
  // Detect if the new bubble is created in the tour
  hasSeenTour = localStorage.getItem('hasSeenTour')
  if (!hasSeenTour && mapBubbles.value.length > 1) {
    isTwoBubbleCreated.value = true
    messageInstance?.close()

    // start the bubble creation tour
    startCreateRelationshipTour()
  }
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
  hasSeenTour = localStorage.getItem('hasSeenTour')
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

      if (!hasSeenTour) {
        startUpdateMenuTour()
      }
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

// // Define track boundaries with inner and outer radii
// const tracks = {
//   mission: { outer: 190, inner: 0 }, // Pink (innermost)
//   strategic: { outer: 350, inner: 190 }, // Green
//   process: { outer: 500, inner: 350 }, // Blue
//   operational: { outer: 650, inner: 500 }, // Orange (outermost)
// }

// // Calculate the middle radius for bubble positioning
// const layerRadii = {
//   mission: (tracks.mission.outer + tracks.mission.inner) / 2,
//   strategic: (tracks.strategic.outer + tracks.strategic.inner) / 2,
//   process: (tracks.process.outer + tracks.process.inner) / 2,
//   operational: (tracks.operational.outer + tracks.operational.inner) / 2,
// }

const tracks = computed(() => ({
  mission: {
    outer: props.data.mapConfig.layerSizes.mission.outer,
    inner: props.data.mapConfig.layerSizes.mission.inner,
  },
  strategic: {
    outer: props.data.mapConfig.layerSizes.strategic.outer,
    inner: props.data.mapConfig.layerSizes.strategic.inner,
  },
  process: {
    outer: props.data.mapConfig.layerSizes.process.outer,
    inner: props.data.mapConfig.layerSizes.process.inner,
  },
  operational: {
    outer: props.data.mapConfig.layerSizes.operational.outer,
    inner: props.data.mapConfig.layerSizes.operational.inner,
  },
}))

// Update layerRadii to be computed from the tracks
const layerRadii = computed(() => ({
  mission: (tracks.value.mission.outer + tracks.value.mission.inner) / 2,
  strategic: (tracks.value.strategic.outer + tracks.value.strategic.inner) / 2,
  process: (tracks.value.process.outer + tracks.value.process.inner) / 2,
  operational: (tracks.value.operational.outer + tracks.value.operational.inner) / 2,
}))

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
  const visibleGroups = groups.filter((group) => group.visible)
  const angleIncrement = (2 * Math.PI) / visibleGroups.length

  visibleGroups.forEach((group, index) => {
    console.log(
      'GroupAngle000--',
      angleIncrement,
      group.name,
      index,
      'ANgles:',
      group.startAngle,
      group.endAngle,
    )

    if (!group.locked) {
      group.startAngle = index * angleIncrement
      group.endAngle = (index + 1) * angleIncrement

      // Normalize if any angle calculation resulted in negative
      if (group.startAngle < 0) group.startAngle += 2 * Math.PI
      if (group.endAngle < 0) group.endAngle += 2 * Math.PI

      console.log('GroupAngle- ' + group.name + ' : ', group.startAngle, group.endAngle)
    }
  })

  return visibleGroups
}

// Add function to draw group dividers
function drawGroupDividers(
  svg: d3.Selection<SVGGElement, unknown, null, undefined>,
  groups: Group[],
  startLayer: LayerType | 'None',
) {
  if (groups.length <= 1) return
  if (startLayer === 'None') return

  const dividerGroup = svg.append('g').attr('class', 'group-dividers')

  // Define the drag behavior
  const drag = d3
    .drag<SVGLineElement, Group>()
    .on('start', function () {
      d3.select(this).raise().attr('stroke', '#999')
    })
    .on('drag', function (event) {
      const [x, y] = d3.pointer(event, svgRef.value!)

      // Unlock every single bubble
      props.data.bubbles.forEach((b) => {
        b.locked = true
      })

      // Adjust Y coordinate for scaling/offset AND INVERT Y-AXIS
      const adjustedY = -(y - centerY - yOffset) / yScale
      const angle = Math.atan2(adjustedY, x - centerX)
      let normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle

      const MIN_ANGLE = 0.3
      const line = d3.select(this)
      const currentGroup = line.datum() as Group
      const currentIndex = groups.indexOf(currentGroup)

      // Get previous and next groups with circular wrapping
      const prevGroup = currentIndex === 0 ? groups[groups.length - 1] : groups[currentIndex - 1]
      const nextGroup = groups[(currentIndex + 1) % groups.length]

      if (currentGroup && prevGroup) {
        currentGroup.locked = true
        prevGroup.locked = true
        currentGroup.isDragging = true
        prevGroup.isDragging = true

        // Special handling for first divider
        if (currentIndex === 0) {
          // Calculate the effective angle considering circular nature
          let effectiveAngle = normalizedAngle

          // Handle angle wrapping at 0/2π boundary
          const angleDiff = normalizedAngle - currentGroup.startAngle!
          if (Math.abs(angleDiff) > Math.PI) {
            // If we've moved past the π boundary, adjust the angle
            effectiveAngle =
              angleDiff > 0 ? normalizedAngle - 2 * Math.PI : normalizedAngle + 2 * Math.PI
          }

          // Constrain movement within valid bounds
          const maxAngle = nextGroup.startAngle! - MIN_ANGLE
          const minAngle = prevGroup.endAngle! - (2 * Math.PI - MIN_ANGLE)
          effectiveAngle = Math.max(minAngle, Math.min(effectiveAngle, maxAngle))

          // Update angles for both groups
          currentGroup.startAngle = effectiveAngle
          prevGroup.endAngle = effectiveAngle

          // The first group's end angle remains at 2π
          //currentGroup.endAngle = 2 * Math.PI

          // For visual positioning, use the original normalizedAngle
          normalizedAngle = effectiveAngle >= 0 ? effectiveAngle : effectiveAngle + 2 * Math.PI
        } else {
          // Standard divider handling (same as before)
          const minBound = prevGroup.startAngle! + MIN_ANGLE
          const maxBound = nextGroup.startAngle! - MIN_ANGLE

          if (maxBound < minBound) {
            // Handle circular case
            if (normalizedAngle > maxBound && normalizedAngle < minBound) {
              const distToMin = normalizedAngle - maxBound
              const distToMax = minBound - normalizedAngle
              normalizedAngle = distToMin < distToMax ? maxBound : minBound
            }
          } else {
            normalizedAngle = Math.max(minBound, Math.min(normalizedAngle, maxBound))
          }

          // Update angles
          currentGroup.startAngle = normalizedAngle
          prevGroup.endAngle = normalizedAngle
        }

        // Update line position
        const startX = centerX + Math.cos(normalizedAngle) * tracks.value[startLayer].inner
        const startY =
          centerY + -Math.sin(normalizedAngle) * tracks.value[startLayer].inner * yScale + yOffset
        const endX = centerX + Math.cos(normalizedAngle) * tracks.value.operational.outer
        const endY =
          centerY + -Math.sin(normalizedAngle) * tracks.value.operational.outer * yScale + yOffset

        line.attr('x1', startX).attr('y1', startY).attr('x2', endX).attr('y2', endY)
      }
    })
    .on('end', function () {
      d3.select(this).attr('stroke', '#000')
      const line = d3.select(this)
      const currentGroup = line.datum() as Group
      const currentIndex = groups.indexOf(currentGroup)
      const prevGroup = currentIndex === 0 ? groups[groups.length - 1] : groups[currentIndex - 1]

      currentGroup.isDragging = false
      prevGroup.isDragging = false
    })

  // Draw all dividers with the same drag behavior
  groups.forEach((group) => {
    if (
      group.startAngle === undefined ||
      group.endAngle === undefined ||
      startLayer === ('None' as LayerType)
    )
      return

    const startX = centerX + Math.cos(group.startAngle) * tracks.value[startLayer].inner
    const startY =
      centerY + -Math.sin(group.startAngle) * tracks.value[startLayer].inner * yScale + yOffset
    const endX = centerX + Math.cos(group.startAngle) * tracks.value.operational.outer
    const endY =
      centerY + -Math.sin(group.startAngle) * tracks.value.operational.outer * yScale + yOffset

    dividerGroup
      .append('line')
      .attr('x1', startX)
      .attr('y1', startY)
      .attr('x2', endX)
      .attr('y2', endY)
      .attr('stroke', props.data.mapConfig.dividerColor || '#000000') // Use configurable color
      .attr('stroke-width', props.data.mapConfig.dividerWidth || 3) // Use configurable width
      .attr('cursor', 'ew-resize')
      .datum(group)
      .call(drag)
  })
}

// Function to add group names
function addGroupNames(svg: d3.Selection<SVGGElement, unknown, null, undefined>, groups: Group[]) {
  console.log('GroupName00--', groups)

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

    // Only calculate the group name position automatically during the initial creation
    if (!group.x || !group.y) {
      const midAngle = calculateMidAngle(group.startAngle, group.endAngle)
      const outerRadius = tracks.value.operational.outer + 20 // Offset outside the outer track
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
      .style('font-weight', group.fontWeight || 'bold') // Default to bold if not specified
      .style('font-size', `${group.fontSize || 24}px`) // Default size if not specified
      .style('fill', group.fontColor || '#000') // Default color if not specified

    if (!isPresentationMode.value) {
      textElement.style('cursor', 'move').call(drag)
    }
  })
}

// Function to calculate midpoint angle for group names
function calculateMidAngle(startAngle: number, endAngle: number): number {
  // Normalize angles to [0, 2π) first
  startAngle = startAngle < 0 ? startAngle + 2 * Math.PI : startAngle
  endAngle = endAngle < 0 ? endAngle + 2 * Math.PI : endAngle

  // Handle the wrap-around case (like when startAngle > endAngle)
  if (startAngle > endAngle) {
    // Calculate midpoint in the "long way around"
    const midpoint = (startAngle + endAngle + 2 * Math.PI) / 2
    // Normalize back to [0, 2π)
    return midpoint > 2 * Math.PI ? midpoint - 2 * Math.PI : midpoint
  }

  // Standard case
  return (startAngle + endAngle) / 2
}

// Add arrows and title
function addArrowsAndTitle(svg: d3.Selection<SVGGElement, unknown, null, undefined>) {
  // Define arrow marker
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 0 12 12')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#000')

  // Define dot marker
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'dot')
    .attr('viewBox', '0 0 12 12')
    .attr('refX', '5')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .append('circle')
    .attr('cx', '5')
    .attr('cy', '5')
    .attr('r', '3')
    .attr('fill', '#000')

  // Define start arrow marker for conflict
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'start-arrow')
    .attr('viewBox', '0 0 12 12')
    .attr('refX', '4')
    .attr('refY', '6')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#000')

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
    .attr('fill', '#000')

  // Define start line arrow marker
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'start-line-arrow')
    .attr('viewBox', '0 0 12 12')
    .attr('refX', '2')
    .attr('refY', '5')
    .attr('markerWidth', '6')
    .attr('markerHeight', '6')
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 5 L 10 5 M 5 0 L 0 5 L 5 10')
    .attr('fill', 'none')
    .attr('stroke', '#000')
    .attr('stroke-width', 1.5)

  // Define end line arrow marker
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'end-line-arrow')
    .attr('viewBox', '0 0 14 12')
    .attr('refX', '9')
    .attr('refY', '5')
    .attr('markerWidth', '8')
    .attr('markerHeight', '6')
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 5 L 10 5 M 5 0 L 10 5 L 5 10')
    .attr('fill', 'none')
    .attr('stroke', '#000')
    .attr('stroke-width', 1.5)

  // Add title at the top of the map
  // svg
  //   .append('text')
  //   .attr('x', centerX)
  //   .attr('y', 32)
  //   .attr('text-anchor', 'middle')
  //   .attr('alignment-baseline', 'middle')
  //   .text(props.data.mapConfig.title)
  //   .style('font-weight', 'bold')
  //   .style('font-size', `${props.data.mapConfig.titleFontSize}px`)
  //   .style('fill', '#000')
  // Add title at the top of the map
  const titleGroup = svg
    .append('g')
    .attr(
      'transform',
      `translate(${props.data.mapConfig.titleX || centerX}, ${props.data.mapConfig.titleY || 32})`,
    )
    .style('cursor', 'move')

  titleGroup
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .text(props.data.mapConfig.title)
    .style('font-size', `${props.data.mapConfig.titleFontSize}px`)
    .style('font-weight', props.data.mapConfig.titleFontWeight || 'bold')
    .style('fill', props.data.mapConfig.titleColor || '#000')

  // Add drag behavior to the title
  const titleDrag = d3
    .drag<SVGGElement, unknown>()
    .on('start', function () {
      d3.select(this).raise()
    })
    .on('drag', function (event) {
      const [x, y] = d3.pointer(event, svgRef.value!)
      d3.select(this).attr('transform', `translate(${x}, ${y})`)

      // Update the title position in the data
      mapConfig.value.titleX = x
      mapConfig.value.titleY = y
    })

  titleGroup.call(titleDrag)

  // Add a timestamp at the bottom left corner
  svg
    .append('text')
    .attr('x', 30)
    .attr('y', height - 40)
    .attr('transform', 'translate(30, 0)')
    .attr('text-anchor', 'middle')
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
    .style('font-size', '22px')
    .style('fill', '#000')

  // Add a logo at the bottom right corner
  svg
    .append('image')
    .attr('x', width - 220)
    .attr('y', height - 120)
    .attr('width', 200)
    .attr('height', 120)
    .attr('xlink:href', logoImage)

  // symbol for resize
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'resize-symbol')
    .attr('viewBox', '0 0 20 20')
    .attr('refX', 10)
    .attr('refY', 10)
    .attr('markerWidth', 12)
    .attr('markerHeight', 12)
    .append('path')
    .attr('d', 'M10,0 L20,10 L10,20 L0,10 Z') // Diamond shape
    .attr('fill', '#409eff')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
}

// For legend explanation dialog
const legendExplanationDialogVisible = ref(false)
const showLegendExplanationDialog = () => {
  legendExplanationDialogVisible.value = true
}
const handleLegendExplanationDialogClose = () => {
  legendExplanationDialogVisible.value = false
}

const drawMap = () => {
  console.log('Map Data', props.data)
  console.log('Tracks:', tracks.value) // Debugging: Log tracks to verify correctness

  if (!svgRef.value || !tracks.value) return

  // Data saving
  localStorage.setItem('MapData', JSON.stringify(props.data))

  // const currentTransform = d3.zoomTransform(mapGroup.node());

  const svg = d3.select(svgRef.value).call(zoom)
  svg.selectAll('*').remove()

  // Create or select the <g> element for the map content
  let mapGroup: d3.Selection<SVGGElement, unknown, null, undefined> = svg.select('g.map-group')
  if (mapGroup.empty()) {
    mapGroup = svg
      .append('g')
      .attr('class', 'map-group')
      .attr('width', width)
      .attr('height', height)
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


  // Calculate group angles
  const updatedGroups = calculateGroupAngles(props.data.groups)
  //, props.data.bubbles
  console.log('UpdatedGroups--', updatedGroups)

  // Draw layers (concentric circles)
  Object.entries(tracks.value)
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

  // Define arrows and title
  addArrowsAndTitle(mapGroup)

  // Draw group dividers with configurable starting layer
  drawGroupDividers(mapGroup, updatedGroups, props.data.groupLevel) // Start from the center if the startLayer is mission

  // Position bubbles along their orbits
  props.data.bubbles.forEach((bubble, i) => {
    if (bubble.locked || !bubble.visible) return

    let angle: number
    let layerRadius: number

    if (bubble.groupId) {
      // Find the group this bubble belongs to
      const group = updatedGroups.find((g) => g.id === bubble.groupId)
      if (group && group.startAngle !== undefined && group.endAngle !== undefined) {
        // Get all bubbles in the group for the same orbit (layer)
        const groupBubbles = props.data.bubbles.filter(
          (b) => b.groupId === group.id && b.layer === bubble.layer,
        )

        const bubbleIndex = groupBubbles.findIndex((b) => b.id === bubble.id)

        // Normalize angles to positive values first
        let startAngle = group.startAngle < 0 ? group.startAngle + 2 * Math.PI : group.startAngle
        let endAngle = group.endAngle < 0 ? group.endAngle + 2 * Math.PI : group.endAngle

        // Handle wrap-around case (when end angle is smaller than start angle)
        if (endAngle < startAngle) {
          endAngle += 2 * Math.PI
        }

        // Calculate the angular range for the group
        const sectorSize = endAngle - startAngle
        const angleStep = sectorSize / (groupBubbles.length + 1) // Leave padding at edges

        // Position the bubble within its orbit
        angle = startAngle + angleStep * (bubbleIndex + 1)

        // Normalize back to [0, 2π) if needed
        if (angle > 2 * Math.PI) {
          angle -= 2 * Math.PI
        } else {
          // Fallback for undefined groups
          angle = (i * (2 * Math.PI)) / props.data.bubbles.length
        }

        // Calculate the bubble's position using its orbit radius
        // layerRadius = layerRadii.value[bubble.layer as keyof typeof layerRadii.value]
        // bubble.x = centerX + layerRadius * Math.cos(angle)
        // bubble.y = centerY + yOffset + layerRadius * -Math.sin(angle) * yScale
      }
    } else {
      // Handle ungrouped bubbles
      if (bubble.layer === 'mission') {
        const ungroupedMissionBubbles = props.data.bubbles.filter(
          (b) => !b.groupId && b.layer === 'mission',
        )

        if (ungroupedMissionBubbles.length === 1) {
          bubble.x = centerX
          bubble.y = centerY + yOffset
          return
        } else {
          const bubbleIndex = ungroupedMissionBubbles.findIndex((b) => b.id === bubble.id)
          angle = (bubbleIndex * (2 * Math.PI)) / ungroupedMissionBubbles.length
        }
      } else {
        const ungroupedBubbles = props.data.bubbles.filter((b) => !b.groupId)
        const bubbleIndex = ungroupedBubbles.findIndex((b) => b.id === bubble.id)
        angle = ((bubbleIndex + 1) * (2 * Math.PI)) / (ungroupedBubbles.length + 1)
      }

      // Calculate the bubble's position using its orbit radius
      layerRadius = layerRadii.value[bubble.layer as keyof typeof layerRadii.value]
      bubble.x = centerX + layerRadius * Math.cos(angle)
      bubble.y = centerY + yOffset + layerRadius * -Math.sin(angle) * yScale
    }
  })

  // Add group names
  addGroupNames(mapGroup, updatedGroups)

  // Constants for bubble sizing
  // let BUBBLE_RADIUS = 15
  // const BUBBLE_RADIUS_X = 55
  // const BUBBLE_RADIUS_Y = 45
  const OFFSET = 4 // Adjust this value to control how far outside the bubbles the lines should start/end
  const TEXT_WIDTH = 160
  const BUBBLE_PADDING_X = 10 // Horizontal padding around the text inside the bubble
  const BUBBLE_PADDING_Y = 15
  const MIN_BUBBLE_RADIUS_X = 70 // Minimum horizontal radius
  const MIN_BUBBLE_RADIUS_Y = 60 // Minimum vertical radius
  const BUBBLE_ASPECT_RATIO = MIN_BUBBLE_RADIUS_X / MIN_BUBBLE_RADIUS_Y // Fixed aspect ratio

  // Add these constants for resize handle sizing
  const RESIZE_HANDLE_SIZE = 16

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
      console.log("IsRelated1", isRelated);

      g.classed('transparent', !!focusedBubbleId.value && !isRelated) // Apply transparency
        .classed('highlight', focusedBubbleId.value === bubble.id) // Highlight focused bubble
    } else {
      g.call(drag)
    }

    const textElement = g
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .text(bubble.text)
      .attr('fill', bubble.fontColor || '#000')
      .attr('font-size', `${bubble.fontSize || 16}px`)
      .style('font-weight', bubble.fontWeight || 'normal')
      .call(wrap, BUBBLE_PADDING_X)

    // Measure the text dimensions
    const textBBox = textElement.node()!.getBBox()
    const textWidth = textBBox.width
    const textHeight = textBBox.height

    //console.log('TextWidth: ', textWidth, 'TextHeight: ', textHeight)

    // Use stored radii if they exist, otherwise calculate based on text
    let bubbleRadiusX = bubble.rx || textWidth / 2 + BUBBLE_PADDING_X
    let bubbleRadiusY = bubble.ry || textHeight / 2 + BUBBLE_PADDING_Y

    // Ensure the bubble has a minimum size and maintains the fixed aspect ratio

    // Scale the bubble to maintain the aspect ratio while respecting the minimum dimensions
    bubbleRadiusX = Math.max(bubbleRadiusX, MIN_BUBBLE_RADIUS_X)
    bubbleRadiusY = Math.max(bubbleRadiusY, MIN_BUBBLE_RADIUS_Y)

    // Adjust the dimensions to maintain the fixed aspect ratio
    if (bubbleRadiusX / bubbleRadiusY > BUBBLE_ASPECT_RATIO) {
      bubbleRadiusY = bubbleRadiusX / BUBBLE_ASPECT_RATIO
    } else {
      bubbleRadiusX = bubbleRadiusY * BUBBLE_ASPECT_RATIO
    }

    // Store the final radii in the bubble data
    bubble.rx = bubbleRadiusX
    bubble.ry = bubbleRadiusY

    console.log(
      'BubbleRadiusX: ',
      bubbleRadiusX,
      'BubbleRadiusY: ',
      bubbleRadiusY,
      'Ratio: ',
      bubbleRadiusX / bubbleRadiusY,
    )

    bubbleRadii.set(bubble.id, { rx: bubbleRadiusX, ry: bubbleRadiusY })

    // Draw the bubble ellipse
    const bubbleEllipse = g
      .append('ellipse')
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

    // Add resize handles if not in presentation mode
    if (!isPresentationMode.value) {
      // Bottom-right resize handle
      const hideHandleTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
      const resizeHandle = g
        .append('rect')
        .attr('class', 'resize-handle')
        .attr('x', bubbleRadiusX - RESIZE_HANDLE_SIZE / 2)
        .attr('y', bubbleRadiusY - RESIZE_HANDLE_SIZE / 2)
        .attr('width', RESIZE_HANDLE_SIZE)
        .attr('height', RESIZE_HANDLE_SIZE)
        .attr('fill', '#409eff')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .attr('rx', 2)
        .style('cursor', 'nwse-resize')
        .style('display', 'none')
        .call(
          d3
            .drag<SVGRectElement, Bubble>()
            .on('start', function (event) {
              if (hideHandleTimeout.value) {
                clearTimeout(hideHandleTimeout.value)
                hideHandleTimeout.value = null
              }

              d3.select(this).style('display', null)
              d3.select(this).raise()
              event.sourceEvent.stopPropagation()

              props.data.bubbles.forEach((b) => {
                b.locked = true
              })

              // Store initial positions
              const [startX, startY] = d3.pointer(event, svgRef.value!)
              event.subject.startX = startX
              event.subject.startY = startY
              event.subject.startRx = bubbleRadiusX
              event.subject.startRy = bubbleRadiusY
            })
            .on('drag', function (event, d) {
              const bubble = mapBubbles.value.find((b) => b.id === d.id)

              if (bubble) {
                // Get current pointer position in SVG coordinates
                const [x, y] = d3.pointer(event, svgRef.value!)

                // Calculate delta from start position
                const dx = x - event.subject.startX
                const dy = y - event.subject.startY

                // Calculate new radii
                let newRx = Math.max(MIN_BUBBLE_RADIUS_X, event.subject.startRx + dx)
                let newRy = Math.max(MIN_BUBBLE_RADIUS_Y, event.subject.startRy + dy)

                // Maintain aspect ratio
                if (newRx / newRy > BUBBLE_ASPECT_RATIO) {
                  newRy = newRx / BUBBLE_ASPECT_RATIO
                } else {
                  newRx = newRy * BUBBLE_ASPECT_RATIO
                }

                // Update bubble data
                bubble.rx = newRx
                bubble.ry = newRy

                // Update visual elements
                d3.select(this.parentNode as Element)
                  .select('ellipse')
                  .attr('rx', newRx)
                  .attr('ry', newRy)

                // Update handle position
                d3.select(this)
                  .attr('x', newRx - RESIZE_HANDLE_SIZE / 2)
                  .attr('y', newRy - RESIZE_HANDLE_SIZE / 2)
              }
            })
            .on('end', function () {
              hideHandleTimeout.value = setTimeout(() => {
                // hide the resize handle after 2 seconds
                resizeHandle.style('display', 'none')
              }, 2000)
            }),
        )

      // Update hover behavior to cancel timeout
      g.on('mouseenter', () => {
        if (hideHandleTimeout.value) {
          clearTimeout(hideHandleTimeout.value)
          hideHandleTimeout.value = null
        }
        resizeHandle.style('display', null)
      }).on('mouseleave', () => {
        hideHandleTimeout.value = setTimeout(() => {
          resizeHandle.style('display', 'none')
        }, 2000)
      })
    }
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

    const CLOSE_DISTANCE_THRESHOLD = 500
    let hideHandlerTimeout: ReturnType<typeof setTimeout> | null = null

    // Initialize control points if they don't exist
    if (!rel.controlPoints) {
      if (distance < CLOSE_DISTANCE_THRESHOLD) {
        // For short distances, start with straight line (midpoint control)
        const midX = (startX + endX) / 2
        const midY = (startY + endY) / 2
        rel.controlPoints = {
          x1: midX,
          y1: midY,
          x2: midX,
          y2: midY,
        }
      } else {
        // For longer distances, use curved line with default control points
        const pointX1 = startX + (endX - startX) / 3 + unitY * 50
        const pointY1 = startY + (endY - startY) / 3 - unitX * 50
        const pointX2 = startX + ((endX - startX) * 2) / 3 + unitY * 50
        const pointY2 = startY + ((endY - startY) * 2) / 3 - unitX * 50
        rel.controlPoints = {
          x1: pointX1,
          y1: pointY1,
          x2: pointX2,
          y2: pointY2,
        }
      }
    }

    // Create the path element
    const line = linkGroup
      .append('path')
      .attr('data-relationship-id', rel.id)
      .attr('stroke', '#000')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')
      .on('mouseover', function () {
        if (hideHandlerTimeout) {
          clearTimeout(hideHandlerTimeout)
          hideHandlerTimeout = null
        }
        d3.selectAll(`circle[data-line-id="${rel.id}"]`).style('display', 'block')
      })
      .on('mouseout', function () {
        hideHandlerTimeout = setTimeout(() => {
          d3.selectAll(`circle[data-line-id="${rel.id}"]`).style('display', 'none')
        }, 3000)
      })

    // Set initial path data based on distance
    if (distance < CLOSE_DISTANCE_THRESHOLD) {
      // For short distances, use quadratic bezier (single control point)
      line.attr(
        'd',
        `M ${startX} ${startY} Q ${rel.controlPoints.x1} ${rel.controlPoints.y1}, ${endX} ${endY}`,
      )
    } else {
      // For longer distances, use cubic bezier (two control points)
      line.attr(
        'd',
        `M ${startX} ${startY} C ${rel.controlPoints.x1} ${rel.controlPoints.y1}, ${rel.controlPoints.x2} ${rel.controlPoints.y2}, ${endX} ${endY}`,
      )
    }

    // Add relationship type markers
    if (rel.type === 'cause-effect') {
      line.attr('marker-end', 'url(#arrow)')
    } else if (rel.type === 'companion') {
      line.attr('marker-start', 'url(#dot)').attr('marker-end', 'url(#dot)')
    } else if (rel.type === 'conflict') {
      line.attr('marker-start', 'url(#start-line-arrow)').attr('marker-end', 'url(#end-line-arrow)')
    } else if (rel.type === 'lead-lag') {
      line.attr('marker-end', 'url(#end-line-arrow)')
    }

    // Add draggable control point handlers
    const addHandler = (
      cx: number,
      cy: number,
      updateCallback: (newX: number, newY: number) => void,
      isMidpoint = false,
    ) => {
      linkGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 10)
        .attr('fill', '#409eff')
        .attr('stroke', '#fff')
        .attr('data-line-id', rel.id)
        .attr('stroke-width', 1.5)
        .style('cursor', 'move')
        .style('display', 'none')
        .call(
          d3
            .drag<SVGCircleElement, unknown>()
            .on('drag', function (event) {
              const [newX, newY] = d3.pointer(event, svgRef.value)

              // Update the control point
              updateCallback(newX, newY)

              // Update the path
              if (distance < CLOSE_DISTANCE_THRESHOLD || isMidpoint) {
                // For short distances or midpoint handler, use quadratic bezier
                line.attr(
                  'd',
                  `M ${startX} ${startY} Q ${rel.controlPoints!.x1} ${rel.controlPoints!.y1}, ${endX} ${endY}`,
                )
              } else {
                // For longer distances, use cubic bezier
                line.attr(
                  'd',
                  `M ${startX} ${startY} C ${rel.controlPoints!.x1} ${rel.controlPoints!.y1}, ${rel.controlPoints!.x2} ${rel.controlPoints!.y2}, ${endX} ${endY}`,
                )
              }

              // Update handler position
              d3.select(this).attr('cx', newX).attr('cy', newY)
            })
            .on('end', function () {
              // Update data store when dragging ends
              const relationship = props.data.relationships.find((r) => r.id === rel.id)
              if (relationship) {
                relationship.controlPoints = {
                  x1: rel.controlPoints!.x1,
                  y1: rel.controlPoints!.y1,
                  x2: rel.controlPoints!.x2,
                  y2: rel.controlPoints!.y2,
                }
              }
            }),
        )
    }

    // Add handlers based on distance
    if (distance < CLOSE_DISTANCE_THRESHOLD) {
      // For short distances, add single midpoint handler
      addHandler(
        rel.controlPoints.x1,
        rel.controlPoints.y1,
        (newX, newY) => {
          rel.controlPoints!.x1 = newX
          rel.controlPoints!.y1 = newY
          rel.controlPoints!.x2 = newX
          rel.controlPoints!.y2 = newY
        },
        true, // isMidpoint
      )
    } else {
      // For longer distances, add two control point handlers
      addHandler(rel.controlPoints.x1, rel.controlPoints.y1, (newX, newY) => {
        rel.controlPoints!.x1 = newX
        rel.controlPoints!.y1 = newY
      })

      addHandler(rel.controlPoints.x2, rel.controlPoints.y2, (newX, newY) => {
        rel.controlPoints!.x2 = newX
        rel.controlPoints!.y2 = newY
      })
    }
  })

  // Add legend to the bottom-left corner
  const legendGroup = mapGroup
    .append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(0, ${height - 500})`) // Adjust the position as needed

  // Add background rectangle for legend
  legendGroup
    .append('rect')
    .attr('x', 0)
    .attr('y', -140)
    .attr('width', 120)
    .attr('height', 570)
    .attr('fill', '#f8f8f8')
    .attr('stroke', '#000')
    .attr('stroke-width', 0)

  // Add "Legend" text at the top
  legendGroup
    .append('text')
    .attr('x', 60)
    .attr('y', -115)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .text('Legend')
    .style('font-size', '20px')
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
      .style('font-size', '16px')
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

  if (!isPresentationMode.value) {
    // Add a circle border around the question mark icon
    legendGroup
      .append('circle')
      .attr('cx', 130) // Adjust the position to match the question mark's x position
      .attr('cy', 0 + 278) // Adjust the position to match the question mark's y position
      .attr('r', 12) // Radius of the circle (adjust as needed)
      .attr('fill', 'none') // No fill
      .attr('stroke', '#409eff') // Border color
      .attr('class', 'non-exportable')
      .attr('stroke-width', 1.5) // Border thickness

    // Add a question mark icon next to the legend lines group
    legendGroup
      .append('text')
      .attr('x', 130) // Adjust the position as needed
      .attr('y', 0 + 280) // Adjust the position as needed
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .text('?')
      .style('font-size', '16px')
      .style('fill', '#409eff')
      .style('cursor', 'pointer')
      .attr('class', 'non-exportable')
      .on('click', () => {
        showLegendExplanationDialog()
      })
  }

  // Add vertical legend lines with text at the top
  let currentY = 0
  props.data.legends.legendLines.forEach((line) => {
    if (line.visible) {
      legendGroup
        .append('text')
        .attr('x', line.x)
        .attr('y', line.y - currentY - 2)
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .text(line.text)
        .style('font-size', '16px')
        .style('fill', '#000')

      const legendLine = legendGroup
        .append('line')
        .attr('x1', line.x - line.length + 3)
        .attr('y1', line.y + 14 - currentY)
        .attr('x2', line.x + line.length - 3)
        .attr('y2', line.y + 14 - currentY)
        .attr('stroke', line.color)
        .attr('stroke-width', 1.5)

      // Add a circle with "A" on the left side of the arrow
      legendGroup
        .append('circle')
        .attr('cx', line.x - line.length - 7) // Adjust the position as needed
        .attr('cy', line.y + 14 - currentY)
        .attr('r', 9) // Radius of the circle
        .attr('fill', 'white')
        .attr('stroke', line.color)
        .attr('stroke-width', 1.5)

      legendGroup
        .append('text')
        .attr('x', line.x - line.length - 7)
        .attr('y', line.y + 15 - currentY)
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .text('A')
        .style('font-size', '14px')
        .style('fill', line.color)

      // Add a circle with "B" on the right side of the arrow
      legendGroup
        .append('circle')
        .attr('cx', line.x + line.length + 7) // Adjust the position as needed
        .attr('cy', line.y + 14 - currentY)
        .attr('r', 9) // Radius of the circle
        .attr('fill', 'white')
        .attr('stroke', line.color)
        .attr('stroke-width', 1.5)

      legendGroup
        .append('text')
        .attr('x', line.x + line.length + 7)
        .attr('y', line.y + 15 - currentY)
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .text('B')
        .style('font-size', '14px')
        .style('fill', line.color)

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
  return new Promise<void>((resolve) => {
    const svg = d3.select(svgRef.value!)
    svg
      .transition()
      .duration(300)
      .call(zoom.transform, d3.zoomIdentity) // Reset zoom
      .on('end', () => {
        resolve()
      })
  })
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
    visible: true,
    fontColor: '#000', // Default color
    fontSize: 24, // Default size
    fontWeight: 'bold', // Default weight
  })

  // Clear the input field and hide the context menu
  newGroupName.value = ''
  emptyPositionContextMenuVisible.value = false

  isFirstGroupCreated.value = true

  // Detect if the new group is created in the tour
  hasSeenTour = localStorage.getItem('hasSeenTour')
  if (!hasSeenTour && mapGroups.value.length > 1) {
    isNewGroupCreated.value = true
    messageInstance?.close()

    // start the bubble creation tour
    startCreateBubbleTour()
  }
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
  const hasSeenPresentationMode = localStorage.getItem('hasSeenPresentationMode')

  isPresentationMode.value = !isPresentationMode.value
  if (isPresentationMode.value) {
    if (!hasSeenPresentationMode) {
      ElMessageBox.confirm(
        'Tip: In presentation mode, move your mouse to the bottom to show the control bar',
        'Presentation Mode',
        {
          confirmButtonText: 'Ok',
          showCancelButton: false,
          type: 'warning',
        },
      )
        .then(() => {
          localStorage.setItem('hasSeenPresentationMode', 'true')
          enterFullscreen()
        })
        .catch(() => {
          return
        })
    } else {
      enterFullscreen()
    }
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

    console.log('newRelationshipssss', newRelationship)

    if (relationshipExists) {
      console.log('A relationship between these bubbles already exists.')
      return // Return false if the relationship already exists
    }

    newRelationship.value.target = bubbleId
    handleAddRelationship()
    isCreatingRelationship.value = false // Exit relationship creation mode

    // Detect if the new relationship is created in the tour
    hasSeenTour = localStorage.getItem('hasSeenTour')
    if (!hasSeenTour) {
      isNewRelationshipCreated.value = true
      messageInstance?.close()

      // show a finish dialog
      ElMessageBox.confirm(
        'You have successfully created a relationship. Do you want to create a new map from scratch or continue working on the current one?',
        'Tour finished',
        {
          confirmButtonText: 'Create New Map',
          cancelButtonText: 'Continue Editing',
          type: 'success',
        },
      )
        .then(() => {
          localStorage.setItem('hasSeenTour', 'true')
          // set data to default
          props.onResetDataToDefault()
        })
        .catch(() => {
          localStorage.setItem('hasSeenTour', 'true')
          return
        })
    }
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

  // Get the initial bubble
  const initialBubble = props.data.bubbles.find(b => b.id === bubbleId)
  if (!initialBubble) {
    return {
      relatedBubbles: [],
      relatedRelationships: []
    }
  }

  // If starting from a mission bubble, just return it
  if (initialBubble.layer === 'mission') {
    return {
      relatedBubbles: [bubbleId],
      relatedRelationships: []
    }
  }

  const exploreRelationships = (currentBubbleId: string, direction: 'outward' | 'inward') => {
    const currentBubble = props.data.bubbles.find(b => b.id === currentBubbleId)
    if (!currentBubble) return

    // Stop if we've reached a mission bubble
    if (currentBubble.layer === 'mission') {
      relatedBubbles.add(currentBubbleId)
      return
    }

    // Find relationships based on direction
    const relationships = direction === 'outward'
      ? props.data.relationships.filter(rel => rel.source === currentBubbleId)
      : props.data.relationships.filter(rel => rel.target === currentBubbleId)

    for (const rel of relationships) {
      if (!relatedRelationships.has(rel.id)) {
        relatedRelationships.add(rel.id)

        const nextBubbleId = direction === 'outward' ? rel.target : rel.source
        const nextBubble = props.data.bubbles.find(b => b.id === nextBubbleId)

        if (!nextBubble) continue

        // Only proceed if we haven't seen this bubble before
        if (!relatedBubbles.has(nextBubbleId)) {
          relatedBubbles.add(nextBubbleId)
          exploreRelationships(nextBubbleId, direction)
        }
      }
    }
  }

  // Start exploration in both directions
  relatedBubbles.add(bubbleId)
  exploreRelationships(bubbleId, 'outward') // Follow relationships where current is source
  exploreRelationships(bubbleId, 'inward')  // Follow relationships where current is target

  return {
    relatedBubbles: Array.from(relatedBubbles),
    relatedRelationships: Array.from(relatedRelationships),
  }
}

const handleClickOutside = (event: MouseEvent) => {
  console.log('click outside')
  // Check if system color picker is open
  const colorPicker = document.querySelector('.el-color-picker[aria-describedby]')
  if (colorPicker) {
    return // Don't close menu if color picker is active
  }

  const contextMenuElement = document.querySelector('.context-menu')
  const tourButton = document.querySelector('.tg-dialog-btn')
  if (
    contextMenuElement &&
    !contextMenuElement.contains(event.target as Node) &&
    !tourButton?.contains(event.target as Node)
  ) {
    hideContextMenu()
  }
}

const generateFileName = (extension: string) => {
  const currentDate = new Date()
  const formattedDate = `${currentDate.getFullYear()}_${String(currentDate.getMonth() + 1).padStart(2, '0')}_${String(
    currentDate.getDate(),
  ).padStart(2, '0')}`
  return `${props.data.mapConfig.title || 'map-export'}_${formattedDate}.${extension}`
}

//export image
const exportMapAsImage = async () => {
  try {
    const svgElement = d3.select(svgRef.value).node() as SVGSVGElement
    if (!svgElement) {
      console.error('SVG element not found')
      return
    }

    // Clone the SVG element to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement

    // Remove non-exportable elements from the cloned SVG
    d3.select(clonedSvg).selectAll('.non-exportable').remove()

    saveSvgAsPng.saveSvgAsPng(clonedSvg, generateFileName('png'), {
      encorderOptions: 1,
      backgroundColor: 'white',
    })
  } catch (error) {
    console.error('Error exporting map as image:', error)
  }
}

// export pdf
const exportMapAsPDF = async (
  svgElement = d3.select(svgRef.value).node() as SVGSVGElement,
  filename = generateFileName('pdf'),
) => {
  // Clone the SVG element to avoid modifying the original
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement

  console.log('Clone', clonedSvg)

  // Remove non-exportable elements from the cloned SVG
  d3.select(clonedSvg).selectAll('.non-exportable').remove()

  const pdf = new jsPDF({
    orientation: 'landscape', // Change to "portrait" if needed
    unit: 'px',
    format: [svgElement.clientWidth, svgElement.clientHeight],
  })

  // Convert SVG to PDF vector format
  await svg2pdf(clonedSvg, pdf, {
    x: 0,
    y: 0,
    width: svgElement.clientWidth,
    height: svgElement.clientHeight,
  })

  pdf.save(filename)
}

//export json with a filename based on the current date
const exportMapAsJson = () => {
  const data = JSON.stringify(props.data, null, 2)
  const filename = generateFileName('resultsmap')
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// open help page
const openHelpCenter = () => {
  const currentUrl = window.location.href
  const helpUrl = currentUrl.replace(/\/[^\/]*$/, '/help') // Replace the current path with '/#/help'
  window.open(helpUrl, '_blank')
}

// Tour related
let hasSeenTour = localStorage.getItem('hasSeenTour')
const tour = inject<TourGuideClient>('tourGuide')

let messageInstance: any = null
const isNewGroupCreated = ref(false)
const isFirstBubbleCreated = ref(false) // Not show the context menu tutorial anymore after the first bubble is created
const isFirstGroupCreated = ref(false) // Not show the context menu tutorial anymore after the first group is created
const isTwoBubbleCreated = ref(false)
const isNewRelationshipCreated = ref(false)

const isIconsTourFinished = ref(false)
const isUpdateMenuTourFinished = ref(false)
const isCreationMenuTourFinished = ref(false)

const startATour = () => {
  hasSeenTour = localStorage.getItem('hasSeenTour')
  isNewGroupCreated.value = false
  isFirstBubbleCreated.value = false
  isTwoBubbleCreated.value = false
  isNewRelationshipCreated.value = false
  isIconsTourFinished.value = false
  isUpdateMenuTourFinished.value = false
  isCreationMenuTourFinished.value = false

  // Configure the tour
  if (tour) {
    tour.setOptions({
      steps: [
        {
          title: 'Zoom In',
          content: 'Click this button to zoom in on the map for a closer view.',
          target: '#zoomInButton', // Target the zoom-in button
        },
        {
          title: 'Zoom Out',
          content: 'Click this button to zoom out on the map for a wider view.',
          target: '#zoomOutButton', // Target the zoom-out button
        },
        {
          title: 'Reset Zoom',
          content: 'Click this button to reset the map zoom to the default level.',
          target: '#resetZoomButton', // Target the reset zoom button
        },
        {
          title: 'Presentation Mode',
          content:
            'Click this button to switch to presentation mode, which hides unnecessary controls for a cleaner view.',
          target: '#presentationModeButton', // Target the presentation mode button
        },
        {
          title: 'Help Center Button',
          content: 'Click this button to open the Help Center in a new tab.',
          target: '#helpCenterButton', // Target the help center button
        },
      ],
      hidePrev: true,
      backdropClass: 'custom-backdrop-class',
    })

    // tour.onBeforeStepChange(() => {
    //   console.log(`Before Changing to step: ${tour.activeStep}`)
    // })

    tour.onFinish(() => {
      console.log('Tour finished 111')
      isIconsTourFinished.value = true

      // Show a message box to inform the user about the next steps
      ElMessageBox.confirm(
        `To create a new section:
          <ol>
            <li>Right-click on the map.</li>
            <li>Type the section name.</li>
            <li>Click the "Create section" button.</li>
          </ol> <br /> <img style="width: 100%;" src="${createGroupGif}"/>`,
        'Create Sections',
        {
          //title: 'Next Steps',
          confirmButtonText: 'Continue',
          cancelButtonText: 'Quit',
          showClose: false,
          type: '',
          customClass: 'custom-message-box-class',
          dangerouslyUseHTMLString: true,
        },
      )
        .then(() => {
          // Start the second tour
          // startCreationMenuTour();
          messageInstance = ElMessage({
            type: 'warning',
            message:
              'Please right-click the map to create a section, ensuring at least two sections are placed on the map.',
            duration: 0, // Make the message persistent
          })
        })
        .catch(() => {
          localStorage.setItem('hasSeenTour', 'true')
          messageInstance?.close()
          ElMessage({
            type: 'warning',
            message:
              'You can always right-click on the map to create or delete sections and bubbles.',
          })
        })
    })

    tour.onBeforeExit(() => {
      console.log('Tour exited - icons')
      if (!isIconsTourFinished.value && tour.isVisible) {
        localStorage.setItem('hasSeenTour', 'true')
        messageInstance?.close()
      }
    })

    setTimeout(() => {
      tour.start()
    }, 400)
  }
}

const startCreateBubbleTour = () => {
  hasSeenTour = localStorage.getItem('hasSeenTour')
  // Show a message box to inform the user about the next steps
  ElMessageBox.confirm(
    `To create a new bubble:
<ol>
  <li>Right-click on the map.</li>
  <li>Type the bubble name.</li>
  <li>Click the "Create Bubble" button.</li>
</ol>  <br /> <img style="width: 100%;" src="${createBubbleGif}"/>`,
    'Create Bubbles',
    {
      //title: 'Next Steps',
      confirmButtonText: 'Continue',
      cancelButtonText: 'Quit',
      showClose: false,
      type: '',
      dangerouslyUseHTMLString: true,
      customClass: 'custom-message-box-class',
    },
  )
    .then(() => {
      // Start the second tour
      // startCreationMenuTour();
      messageInstance = ElMessage({
        type: 'warning',
        message:
          'Please right-click the map to create bubbles, ensuring at least two bubbles are placed on the map.',
        duration: 0, // Make the message persistent
      })
    })
    .catch(() => {
      localStorage.setItem('hasSeenTour', 'true')
      messageInstance?.close()
      ElMessage({
        type: 'warning',
        message: 'You can always right-click on the map to create or delete sections and bubbles.',
      })
    })
}

const startCreateRelationshipTour = () => {
  hasSeenTour = localStorage.getItem('hasSeenTour')
  // Show a message box to inform the user about the next steps
  ElMessageBox.confirm(
    `To create a relationship between two bubbles:
<ol>
  <li>Right-click on the bubble where the relationship begins.</li>
  <li>Select the type of relationship.</li>
  <li>Click the "Create Relationship" button.</li>
  <li>Left-click on the target bubble where the relationship ends.</li>
</ol>
  <br /> <img style="width: 100%; margin-top: 10px;" src="${createRelationshipGif}"/>`,
    'Create Relationship',
    {
      //title: 'Next Steps',
      confirmButtonText: 'Continue',
      cancelButtonText: 'Quit',
      showClose: false,
      type: '',
      dangerouslyUseHTMLString: true,
      customClass: 'custom-message-box-class',
    },
  )
    .then(() => {
      // Start the second tour
      // startCreationMenuTour();
      messageInstance = ElMessage({
        type: 'warning',
        message: 'Please right-click the bubble to create a new relationship',
        duration: 0, // Make the message persistent
      })
    })
    .catch(() => {
      localStorage.setItem('hasSeenTour', 'true')
      messageInstance?.close()
      ElMessage({
        type: 'warning',
        message: 'You can always right-click on the map to create or delete sections and bubbles.',
      })
    })
}

const startUpdateMenuTour = () => {
  hasSeenTour = localStorage.getItem('hasSeenTour')
  const steps = [
    // {
    //   title: 'Bubble Section',
    //   content:
    //     'In this section, you can update the text of the bubble or remove it from the map. Use the "Update" button to save changes or the "Remove" button to delete the bubble.',
    //   target: '#updateBubbles',
    // },
    // {
    //   title: 'Relationship Section',
    //   content:
    //     'In this section, you can create new relationships between bubbles or manage existing ones. Use the dropdown to select a relationship type, then click "Create Relationship". For existing relationships, you can update their type or delete them.',
    //   target: '#manageRelationships',
    // },
  ]

  if (!isNewRelationshipCreated.value) {
    steps.push({
      title: 'Relationship Section',
      content:
        'In this section, you can create new relationships between bubbles or manage existing ones. Use the dropdown to select a relationship type, then click "Create Relationship". For existing relationships, you can update their type or delete them.',
      target: '#manageRelationships',
    })
  } else if (isNewRelationshipCreated.value) {
    steps.push({
      title: 'Relationship Section',
      content:
        'In this section, you can create new relationships between bubbles or manage existing ones. Use the dropdown to select a relationship type, then click "Create Relationship". For existing relationships, you can update their type or delete them.',
      target: '#manageRelationships',
    })
  }

  if (tour) {
    tour.setOptions({
      steps,
      hidePrev: true,
      backdropClass: 'custom-backdrop-class',
    })

    // Handle the end of the second tour
    tour.onFinish(() => {
      console.log('Second tour finished')
      isUpdateMenuTourFinished.value = true
      // ElMessage({
      //   type: 'success',
      //   message: 'You are now ready to create bubbles and groups!',
      // })
    })

    tour.onBeforeExit(() => {
      console.log('Tour exited - update menu')
      if (!isUpdateMenuTourFinished.value && tour.isVisible) {
        localStorage.setItem('hasSeenTour', 'true')
        messageInstance?.close()
      }
    })

    // Start the tour
    setTimeout(() => {
      tour.start()
    }, 300)
  }
}

const startCreationMenuTour = () => {
  hasSeenTour = localStorage.getItem('hasSeenTour')
  if (tour) {
    const steps = [
      // {
      //   title: 'Create a Bubble',
      //   content:
      //     'Use the context menu to create a new bubble by entering text and clicking "Create".',
      //   target: '#createBubble', // Target the context menu for empty positions
      // },
      // {
      //   title: 'Create or Delete a Group',
      //   content: 'You can also create or delete a group using the context menu.',
      //   target: '#createGroup', // Target the context menu for empty positions
      // },
    ]

    if (!isNewGroupCreated.value) {
      steps.push({
        title: 'Create or Delete a Section',
        content:
          "You can create or delete a section, and change the section's font size, weight, and color using the context menu.",
        target: '#createGroup', // Target the context menu for empty positions
      })
    }

    if (isNewGroupCreated.value && !isFirstBubbleCreated.value) {
      steps.push({
        title: 'Create a Bubble',
        content:
          'Use the context menu to create a new bubble by entering text and clicking "Create".',
        target: '#createBubble', // Target the context menu for empty positions
      })
    }

    tour.setOptions({
      steps,
      hidePrev: true,
      backdropClass: 'custom-backdrop-class',
    })

    // Handle the end of the second tour
    tour.onFinish(() => {
      console.log('Second tour finished')
      isCreationMenuTourFinished.value = true
      // ElMessage({
      //   type: 'success',
      //   message: 'You are now ready to create bubbles and groups!',
      // })
    })

    tour.onBeforeExit(() => {
      console.log('Tour exited - update menu')
      if (!isCreationMenuTourFinished.value && tour.isVisible) {
        localStorage.setItem('hasSeenTour', 'true')
        messageInstance?.close()
      }
    })

    // Start the second tour
    tour.start()
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
function wrap_old(
  text: d3.Selection<SVGTextElement, Bubble, null, undefined>,
  maxWidth: number,
): void {
  text.each(function (this: SVGTextElement, d: Bubble) {
    const textElement = d3.select<SVGTextElement, Bubble>(this)
    const words: string[] = textElement.text().split(/\s+/) // Split text into words
    const lineHeight: number = 1.1 // Line height in ems

    // Dynamic word distribution rules
    let maxMiddleWords: number, topLineWords: number
    if (words.length <= 10) {
      maxMiddleWords = 2 // Middle line max words for very short text
      topLineWords = 2 // Top line words for very short text
    } else if (words.length <= 20 && words.length > 10) {
      maxMiddleWords = 3
      topLineWords = 2
    } else if (words.length <= 30 && words.length > 20) {
      maxMiddleWords = 3
      topLineWords = 3
    } else if (words.length <= 80 && words.length > 30) {
      maxMiddleWords = 4
      topLineWords = 3
    } else if (words.length > 80) {
      maxMiddleWords = 6
      topLineWords = 4
    } else {
      maxMiddleWords = 5
      topLineWords = 3
    }

    if (words.length <= 3) {
      // If 3 or fewer words, keep the text as a single line in the middle
      textElement.text(words.join(' '))
      return
    }

    // Clear the text
    textElement.text(null)

    // Function to calculate the total letters in the first `topLineWords`
    const getTotalLetters = (startIndex: number, wordCount: number): number => {
      return words.slice(startIndex, startIndex + wordCount).join('').length
    }

    // Adjust the first top line if the total letters are less than 10
    const firstTopLineLetters: number = getTotalLetters(0, topLineWords)

    console.log('firstTopLineLetters- 0', firstTopLineLetters, topLineWords)

    const firstTopLineWordCount: number =
      firstTopLineLetters < 10 && topLineWords > 2 ? topLineWords + 1 : topLineWords

    console.log('firstTopLineLetters', firstTopLineLetters, firstTopLineWordCount)

    // Distribute words into lines in an ellipse-like shape
    const lines: string[] = []
    let currentIndex: number = 0

    // Function to add a line with a specific number of words
    const addLine = (wordCount: number): void => {
      if (currentIndex < words.length) {
        lines.push(words.slice(currentIndex, currentIndex + wordCount).join(' '))
        currentIndex += wordCount
      }
    }

    // Top lines: gradually increase word count
    addLine(firstTopLineWordCount) // First top line
    //addLine(topLineWords + 1); // Second top line

    let maxMWords = maxMiddleWords

    // Middle lines: maximum words
    while (currentIndex < words.length) {
      if (getTotalLetters(currentIndex, maxMiddleWords) < 14) {
        maxMWords += Math.floor(topLineWords / 2) // Middle line
      } else {
        if (maxMWords > maxMiddleWords) {
          maxMWords -= Math.floor(topLineWords / 2) // Middle line
        }
      }
      addLine(maxMWords) // Middle line
      maxMWords = maxMiddleWords
    }

    // if(getTotalLetters(currentIndex, topLineWords) < 15){
    //   topLineWords += Math.floor(topLineWords/2); // Middle line
    // } else {
    //   topLineWords -= Math.floor(topLineWords/2); // Middle line
    // }

    // Bottom lines: gradually decrease word count
    // addLine(topLineWords); // First bottom line
    // addLine(topLineWords); // Second bottom line
    //if (words.length >= 30) addLine(1); // Last bottom line for long text

    // Calculate the total height of the text
    const totalHeight: number = lines.length * lineHeight // Total height in ems

    // Add a small offset to move the text down slightly
    const offset: number = 0.8 // Adjust this value to move the text down (e.g., 0.5em)

    // Add the lines to the text element
    lines.forEach((line: string, i: number) => {
      textElement
        .append('tspan')
        .attr('x', 0)
        .attr('dy', i === 0 ? `-${totalHeight / 2 - offset}em` : `${lineHeight}em`) // Adjust vertical spacing
        .attr('text-anchor', 'middle') // Center-align each line
        .attr('fill', d.fontColor || '#000')
        .attr('font-size', `${d.fontSize || 16}px`)
        .style('font-weight', d.fontWeight || 'normal')
        .text(line)
    })
  })
}

function wrap(text: d3.Selection<SVGTextElement, Bubble, null, undefined>, maxWidth: number): void {
  let targetLineLength: number = 20 // New parameter with default value
  let topLineMaxLength: number = 18 // Also made this configurable

  text.each(function (this: SVGTextElement, d: Bubble) {
    const textElement = d3.select<SVGTextElement, Bubble>(this)
    const words: string[] = textElement.text().split(/\s+/)
    const lineHeight: number = 1.1

    if (words.length <= 10) {
      targetLineLength = 14
      topLineMaxLength = 8
    }

    // Clear the text
    textElement.text(null)

    // Function to calculate the total characters in a range of words
    const getTotalChars = (startIndex: number, wordCount: number): number => {
      return words.slice(startIndex, startIndex + wordCount).join(' ').length
    }

    // Distribute words into lines with dynamic adjustment
    const lines: string[] = []
    let currentIndex: number = 0

    // Handle first line (max topLineMaxLength characters)
    if (words.length > 0) {
      let firstLineWords = 0
      let firstLineChars = 0

      while (firstLineWords < words.length && firstLineChars < topLineMaxLength) {
        firstLineWords++
        firstLineChars = getTotalChars(0, firstLineWords)
      }

      if (firstLineChars > topLineMaxLength && firstLineWords > 1) {
        firstLineWords--
      }

      lines.push(words.slice(0, firstLineWords).join(' '))
      currentIndex = firstLineWords
    }

    // Handle remaining lines (target targetLineLength characters)
    while (currentIndex < words.length) {
      let wordCount = 1
      let currentChars = getTotalChars(currentIndex, wordCount)
      const maxAcceptableLength = targetLineLength * 1.25 // 25% over target

      while (currentIndex + wordCount < words.length) {
        const nextWordCount = wordCount + 1
        const nextChars = getTotalChars(currentIndex, nextWordCount)

        if (currentChars < targetLineLength) {
          if (
            nextChars <= maxAcceptableLength ||
            Math.abs(targetLineLength - nextChars) < Math.abs(targetLineLength - currentChars)
          ) {
            wordCount = nextWordCount
            currentChars = nextChars
          } else {
            break
          }
        } else {
          if (
            wordCount > 1 &&
            Math.abs(targetLineLength - getTotalChars(currentIndex, wordCount - 1)) <
              Math.abs(targetLineLength - currentChars)
          ) {
            wordCount -= 1
            currentChars = getTotalChars(currentIndex, wordCount)
          }
          break
        }
      }

      wordCount = Math.min(wordCount, words.length - currentIndex)
      lines.push(words.slice(currentIndex, currentIndex + wordCount).join(' '))
      currentIndex += wordCount
    }

    // Calculate the total height of the text
    const totalHeight: number = lines.length * lineHeight
    const offset: number = 0.8

    // Add the lines to the text element
    lines.forEach((line: string, i: number) => {
      textElement
        .append('tspan')
        .attr('x', 0)
        .attr('dy', i === 0 ? `-${totalHeight / 2 - offset}em` : `${lineHeight}em`)
        .attr('text-anchor', 'middle')
        .attr('fill', d.fontColor || '#000')
        .attr('font-size', `${d.fontSize || 16}px`)
        .style('font-weight', d.fontWeight || 'normal')
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

defineExpose({
  resetZoom,
  exportMapAsImage,
  exportMapAsPDF,
  exportMapAsJson,
  startATour,
})
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
              <span style="margin: 0 10px 0 0; line-height: 30px">Sections: </span>
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
                  {{ group.name || `Section ${index + 1}` }}
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
      <el-button id="zoomInButton" @click="zoomIn" icon="Plus"></el-button>
      <el-button id="zoomOutButton" @click="zoomOut" icon="Minus"></el-button>
      <el-button id="resetZoomButton" @click="resetZoom" icon="RefreshRight"></el-button>
      <el-button
        id="presentationModeButton"
        style="margin: 15px 0 0 0"
        @click="togglePresentationMode"
        :class="{ 'presentation-mode': isPresentationMode }"
        :icon="`${isPresentationMode ? 'Platform' : 'Monitor'}`"
      ></el-button>
      <el-button id="helpCenterButton" style="margin: 4px 0 0 0" @click="openHelpCenter">
        <template #icon>
          <img :src="QuestionSvg" alt="Custom Question Icon" style="height: 18px" />
        </template>
      </el-button>
    </div>
  </div>

  <!-- legends explanation-->

  <el-dialog
    v-model="legendExplanationDialogVisible"
    title="Relationship Types Explanation"
    width="30%"
    top="35vh"
    :modal="false"
    :before-close="handleLegendExplanationDialogClose"
  >
    <ul class="legend-explanation">
      <li><strong>Cause-Effect</strong>: if A improves, then B improves.</li>
      <li><strong>Companion</strong>: no sense improving A without B.</li>
      <li><strong>Conflict</strong>: if A improves, B gets worse.</li>
      <li><strong>Lead-Lag</strong>: if A improves, then B will improve but later.</li>
    </ul>
  </el-dialog>

  <!-- context menu for bubble updates -->
  <div
    v-if="contextMenuVisible"
    :style="{ top: `${contextMenuPosition.y}px`, left: `${contextMenuPosition.x}px` }"
    class="context-menu bubble-context-menu"
  >
    <div id="updateBubbles">
      <el-divider> Bubble </el-divider>
      <!-- <h4>Bubble</h4> -->
      <el-form @submit.prevent="updateBubbleText">
        <el-form-item label="">
          <el-input v-model="newText" autosize type="textarea" />
          <el-button type="primary" style="width: 100%; margin: 6px 0 0 0" @click="updateBubbleText"
            >Update</el-button
          >
        </el-form-item>

        <template v-if="selectedBubble">
          <!-- Add color picker -->
          <el-form-item label="Color">
            <el-color-picker v-model="selectedBubble.fontColor" ref="colorPicker" />
          </el-form-item>

          <!-- Add font size slider -->
          <el-form-item label="Font Size">
            <el-slider v-model="selectedBubble.fontSize" :min="16" :max="100" :step="1" />
          </el-form-item>

          <!-- Add font weight toggle -->
          <el-form-item label="Bold Text">
            <el-switch
              v-model="selectedBubble.fontWeight"
              active-value="bold"
              inactive-value="normal"
            />
          </el-form-item>
        </template>

        <el-form-item class="margin-top-less">
          <el-popconfirm title="Are you sure to remove this?" @confirm="confirmRemoveBubble">
            <template #reference>
              <el-button style="width: 100%; margin: 4px 0 0 0" type="danger"
                >Remove current bubble</el-button
              >
            </template>
          </el-popconfirm>
        </el-form-item>
      </el-form>
    </div>

    <div id="manageRelationships" style="margin-top: 20px">
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
        style="width: 100%; margin: 0px 0 5px 0"
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
              .filter(
                (rel) => rel.source === selectedBubble?.id || rel.target === selectedBubble?.id,
              )
              .reverse()"
            :key="relationship.id"
          >
            <span class="text-ellipsis">
              <el-icon style="vertical-align: middle; margin-right: 2px"><Link /></el-icon>
              {{
                props.data.bubbles.find((b) =>
                  selectedBubble?.id === relationship.target
                    ? b.id === relationship.source
                    : b.id === relationship.target,
                )?.text
              }}</span
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
    <div id="createBubble">
      <el-divider> Bubble </el-divider>
      <el-form @submit.prevent="createBubble">
        <el-form-item label="">
          <el-input v-model="newBubbleText" autosize type="textarea" />
        </el-form-item>
        <el-form-item>
          <el-button
            class="margin-top-less"
            type="primary"
            style="width: 100%"
            @click="createBubble"
            >Create Bubble</el-button
          >
        </el-form-item>
      </el-form>
    </div>
    <div id="createGroup" style="margin-top: 20px">
      <el-divider> Section </el-divider>
      <el-form @submit.prevent="createGroup">
        <el-form-item label="">
          <el-input v-model="newGroupName" type="text" placeholder="Enter section name" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="margin-top-less" style="width: 100%" @click="createGroup"
            >Create Section</el-button
          >
        </el-form-item>

        <template v-if="currentGroup">
          <el-form-item label="">
            <div class="flex-row" style="margin: 3px 0">
              <span style="margin: 0 5px 0 0">Rename: </span>
              <el-input
                v-model="currentGroup.name"
                style="width: 70%"
                type="text"
                placeholder="Enter section name"
              />
            </div>
          </el-form-item>

          <!-- Add font controls for the group -->
          <el-form-item label="Text Color">
            <el-color-picker v-model="currentGroup.fontColor" ref="colorPicker" />
          </el-form-item>

          <el-form-item label="Text Size">
            <el-slider v-model="currentGroup.fontSize" :min="16" :max="100" :step="1" />
          </el-form-item>

          <el-form-item label="Bold Text">
            <el-switch
              v-model="currentGroup.fontWeight"
              active-value="bold"
              inactive-value="normal"
            />
          </el-form-item>
        </template>

        <el-popconfirm
          :title="`Are you sure you want to delete the section '${currentGroup?.name}'' and all its bubbles?`"
          @confirm="deleteCurrentGroup"
        >
          <template #reference>
            <el-button v-if="currentGroup" type="danger" style="width: 100%; margin-top: 0px">
              Delete Current Section
            </el-button>
          </template>
        </el-popconfirm>
      </el-form>
    </div>
  </div>
</template>
<style>
/* Add this to your existing styles */
.resize-handle {
  pointer-events: all;
}

.bubble-group:hover .resize-handle {
  display: block;
}

/* Make sure text stays centered when bubble is resized */
text {
  dominant-baseline: middle;
  text-anchor: middle;
}

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

.legend-explanation strong {
  font-size: 14px;
  color: #000;
  font-weight: bold;
}

.legend-explanation {
  padding: 0 30px;
}

.legend-explanation li {
  font-size: 14px;
  color: #000;
  line-height: 26px;
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
