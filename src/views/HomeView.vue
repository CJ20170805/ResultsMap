<script setup lang="ts">
import { ref } from 'vue'
import ResultsMap from '@/components/ResultsMap.vue'
import type { ResultsMapData } from '@/types/ResultsMap'

const mapData = ref<ResultsMapData>({
  bubbles: [
    { id: '1', text: 'fires are prevented', layer: 'strategic' },
    { id: '2', text: 'less injury from fire incidents', layer: 'mission' },
    { id: '3', text: 'crews arrive at emergencies quickly', layer: 'process' },
    { id: '4', text: 'transit without bottlenecks', layer: 'operational' },
    // Add more bubbles as needed
  ],
  relationships: [
    { id: '1', source: '1', target: '2', type: 'cause-effect' },
    { id: '2', source: '3', target: '4', type: 'companion' },
    // Add more relationships as needed
  ]
})
</script>

<template>
  <main>
    <ResultsMap :data="mapData" />
  </main>
</template>
