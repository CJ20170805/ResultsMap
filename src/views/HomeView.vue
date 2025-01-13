<script setup lang="ts">
import { ref } from 'vue'
import ResultsMap from '@/components/ResultsMap.vue'
import ResultsMapControls from '@/components/ResultsMapControls.vue'
import type { ResultsMapData, Bubble, Relationship, Group } from '@/types/ResultsMap'

const mapData = ref<ResultsMapData>({
  bubbles: [
    { id: '1', text: 'fires are prevented', layer: 'strategic', groupId: '' },
    { id: '2', text: 'less injury from fire incidents', layer: 'mission', groupId: '' },
    { id: '3', text: 'crews arrive at emergencies quickly', layer: 'process', groupId: '' },
    { id: '4', text: 'transit without bottlenecks', layer: 'operational', groupId: '' },
  ],
  relationships: [
    { id: '1', source: '1', target: '2', type: 'cause-effect' },
    { id: '2', source: '3', target: '4', type: 'companion' },
  ],
  groups: []
})

const addBubble = (bubble: Omit<Bubble, 'id'>) => {
  const newId = (mapData.value.bubbles.length + 1).toString()
  mapData.value.bubbles.push({
    ...bubble,
    id: newId
  })
}

const addRelationship = (relationship: Omit<Relationship, 'id'>) => {
  const newId = (mapData.value.relationships.length + 1).toString()
  mapData.value.relationships.push({
    ...relationship,
    id: newId
  })
}

const addGroup = (group: Omit<Group, 'id'>) => {
  const newId = (mapData.value.groups.length + 1).toString()
  mapData.value.groups.push({
    ...group,
    id: newId
  })
}
</script>

<template>
  <main>
    <ResultsMapControls :onAddBubble="addBubble" :onAddRelationship="addRelationship" :onAddGroup="addGroup"
      :groups="mapData.groups" />
    <ResultsMap :data="mapData" />
  </main>
</template>

<style scoped>
main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}
</style>
