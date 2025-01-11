<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import type { ResultsMapData, Bubble, Relationship } from '@/types/ResultsMap'

const props = defineProps<{
    data: ResultsMapData
}>()

const svgRef = ref<SVGElement | null>(null)
const width = 1000
const height = 800
const centerX = width / 2
const centerY = height / 2

// Layer radiuses
const layerRadii = {
    mission: 150,    // Pink (innermost)
    strategic: 250,  // Green
    process: 350,    // Blue
    operational: 450 // Orange (outermost)
}

// Layer colors
const layerColors = {
    mission: '#ffcdd2',    // Pink
    strategic: '#c8e6c9',  // Green
    process: '#bbdefb',    // Blue
    operational: '#ffe0b2' // Orange
}

const drawMap = () => {
    if (!svgRef.value) return

    const svg = d3.select(svgRef.value)
    svg.selectAll('*').remove()

    // Draw layers (concentric circles)
    Object.entries(layerRadii).reverse().forEach(([layer, radius]) => {
        svg.append('circle')
            .attr('cx', centerX)
            .attr('cy', centerY)
            .attr('r', radius)
            .attr('fill', layerColors[layer as keyof typeof layerColors])
            .attr('opacity', 0.3)
    })

    // Position bubbles along their orbits
    props.data.bubbles.forEach((bubble, i) => {
        const radius = layerRadii[bubble.layer]
        const angle = (i * (2 * Math.PI)) / props.data.bubbles.length
        bubble.x = centerX + radius * Math.cos(angle)
        bubble.y = centerY + radius * Math.sin(angle)
    })

    // Draw relationships
    const linkGroup = svg.append('g')
    props.data.relationships.forEach(rel => {
        const source = props.data.bubbles.find(b => b.id === rel.source)
        const target = props.data.bubbles.find(b => b.id === rel.target)

        if (!source || !target) return

        const line = linkGroup.append('path')
            .attr('d', `M ${source.x} ${source.y} L ${target.x} ${target.y}`)
            .attr('stroke', '#666')
            .attr('stroke-width', 1.5)

        if (rel.type === 'cause-effect') {
            // Add arrow marker
            line.attr('marker-end', 'url(#arrow)')
        } else if (rel.type === 'companion') {
            // Add circles at both ends
            line.attr('marker-start', 'url(#dot)')
                .attr('marker-end', 'url(#dot)')
        }
    })

    // Draw bubbles
    const bubbleGroup = svg.append('g')
    props.data.bubbles.forEach(bubble => {
        const g = bubbleGroup.append('g')
            .attr('transform', `translate(${bubble.x},${bubble.y})`)

        g.append('circle')
            .attr('r', 40)
            .attr('fill', layerColors[bubble.layer])
            .attr('stroke', '#666')

        g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.3em')
            .attr('font-size', '12px')
            .text(bubble.text)
            .call(wrap, 70)
    })
}

// Helper function to wrap text
function wrap(text: d3.Selection<any, any, any, any>, width: number) {
    text.each(function () {
        const text = d3.select(this)
        const words = text.text().split(/\s+/).reverse()
        let word
        let line: string[] = []
        let lineNumber = 0
        const lineHeight = 1.1
        const y = text.attr('y')
        const dy = parseFloat(text.attr('dy'))
        let tspan = text.text(null).append('tspan')
            .attr('x', 0)
            .attr('y', y)
            .attr('dy', dy + 'em')

        while (word = words.pop()) {
            line.push(word)
            tspan.text(line.join(' '))
            if (tspan.node()?.getComputedTextLength() > width) {
                line.pop()
                tspan.text(line.join(' '))
                line = [word]
                tspan = text.append('tspan')
                    .attr('x', 0)
                    .attr('y', y)
                    .attr('dy', ++lineNumber * lineHeight + dy + 'em')
                    .text(word)
            }
        }
    })
}

onMounted(() => {
    drawMap()
})

watch(() => props.data, drawMap, { deep: true })
</script>

<template>
    <svg ref="svgRef" :width="width" :height="height">
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6"
                orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#666" />
            </marker>
            <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
                <circle cx="5" cy="5" r="4" fill="#666" />
            </marker>
        </defs>
    </svg>
</template>