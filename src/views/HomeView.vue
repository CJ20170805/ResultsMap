<script setup lang="ts">
import { ref } from 'vue'
import ResultsMap from '@/components/ResultsMap.vue'
import ResultsMapControls from '@/components/ResultsMapControls.vue'
import type { ResultsMapData, Bubble, Relationship, Group, LayerType } from '@/types/ResultsMap'

const mapData = ref<ResultsMapData>({
  bubbles: [
    { id: '1', text: 'fires are prevented', layer: 'strategic', groupId: '1' },
    { id: '2', text: 'less injury from fire incidents', layer: 'mission', groupId: '1' },
    { id: '3', text: 'crews arrive at emergencies quickly', layer: 'process', groupId: '2' },
    { id: '4', text: 'transit without bottlenecks', layer: 'operational', groupId: '3' },
  ],
  relationships: [
    { id: '1', source: '1', target: '2', type: 'cause-effect' },
    { id: '2', source: '3', target: '4', type: 'companion' },
    { id: '3', source: '1', target: '4', type: 'conflict' },
  ],
  groups: [
    {id: "1", name: "G1", startAngle: 0, endAngle: 2, layers: ["process"]},
    {id: "2", name: "G2", startAngle: 2, endAngle: 4, layers: ["process"]},
    {id: "3", name: "GROUP3 WITH A LONG NAME", startAngle: 4, endAngle: 6, layers: ["process"]},
  ],
  groupLevel: "process"
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

const changeGroupLevel = (groupLevel: LayerType) => {
  mapData.value.groupLevel = groupLevel;
  console.log("changeGroupLevel", groupLevel);

}
</script>

<template>
  <main>
    <ResultsMapControls :mapData="mapData" :onAddBubble="addBubble" :onAddRelationship="addRelationship" :onAddGroup="addGroup"
      :groups="mapData.groups" :onChangeGroupLevel="changeGroupLevel" />
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
