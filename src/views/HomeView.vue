<script setup lang="ts">
import { ref } from 'vue'
import ResultsMap from '@/components/ResultsMap.vue'
import ResultsMapControls from '@/components/ResultsMapControls.vue'
import type {
  ResultsMapData,
  Bubble,
  Relationship,
  Group,
  LayerType,
  MapConfig,
} from '@/types/ResultsMap'
import type { DrawerProps } from 'element-plus'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const showAside = ref(true)

const mapData = ref<ResultsMapData>({
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
    { id: '1', name: 'G1', startAngle: 0, endAngle: 2 },
    { id: '2', name: 'G2', startAngle: 2, endAngle: 4 },
    { id: '3', name: 'GROUP3 WITH A LONG NAME', startAngle: 4, endAngle: 6 },
  ],
  groupLevel: 'strategic',
  legends: {
    legendBubbles: [
      { cx: 30, cy: 250, rx: 40, ry: 30, track: 'operational', text: 'Operational' },
      { cx: 30, cy: 180, rx: 40, ry: 30, track: 'process', text: 'Process' },
      { cx: 30, cy: 110, rx: 40, ry: 30, track: 'strategic', text: 'Strategic' },
      { cx: 30, cy: 40, rx: 40, ry: 30, track: 'mission', text: 'Mission' },
    ],
    legendLines: [
      { x: 30, y: 310, length: 30, color: '#666', type: 'Cause-Effect', text: 'Cause-Effect' },
      { x: 30, y: 344, length: 30, color: '#666', type: 'Conflict', text: 'Conflict' },
      { x: 30, y: 378, length: 30, color: '#666', type: 'Companion', text: 'Companion' },
      { x: 30, y: 412, length: 30, color: '#666', type: 'Lead-Lag', text: 'Lead-Lag' },
    ],
  },
})

const addBubble = (bubble: Omit<Bubble, 'id'>) => {
  const newId = (mapData.value.bubbles.length + 1).toString()
  mapData.value.bubbles.push({
    ...bubble,
    id: newId,
  })
}

const addRelationship = (relationship: Omit<Relationship, 'id'>) => {
  const newId = (mapData.value.relationships.length + 1).toString()
  mapData.value.relationships.push({
    ...relationship,
    id: newId,
  })
}

const addGroup = (group: Omit<Group, 'id'>) => {
  const newId = (mapData.value.groups.length + 1).toString()
  mapData.value.groups.push({
    ...group,
    id: newId,
  })
}

const deleteGroup = (index: number) => {
  mapData.value.groups.splice(index, 1)
}

const changeGroupLevel = (groupLevel: LayerType) => {
  mapData.value.groupLevel = groupLevel
  console.log('changeGroupLevel', groupLevel)
}

const toggleAside = () => {
  showAside.value = !showAside.value
}
</script>

<template>
  <div class="home-container">
    <!-- Navigation Bar -->
    <!-- <el-header>
      <el-row>
        <el-col :span="20">
          <h1 style="color: white; margin-left: 16px">Results Map</h1>
        </el-col>
      </el-row>
    </el-header> -->

    <el-container class="main-container">
      <el-aside v-show="showAside" width="400px">
        <div class="aside-container">
          <ResultsMapControls
            :mapData="mapData"
            :onAddBubble="addBubble"
            :onAddRelationship="addRelationship"
            :onAddGroup="addGroup"
            :onDeleteGroup="deleteGroup"
            :groups="mapData.groups"
            :onChangeGroupLevel="changeGroupLevel"
          />
        </div>
      </el-aside>
      <el-button
        class="toggle-button"
        :class="{ opened: showAside }"
        :icon="showAside ? ArrowLeft : ArrowRight"
        @click="toggleAside"
      >
      </el-button>
      <!-- Main Content -->
      <el-main>
        <ResultsMap :data="mapData" />
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
.home-container {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.align-right {
  text-align: right;
}

.el-aside {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
  padding: 20px 10px 0;
  border-right: 1px solid #f3f3f3;
}
.main-container {
  flex: 1;
  overflow: hidden;
}
.aside-container {
}
.toggle-button {
  padding: 10px;
  width: 24px;
  height: 38px;
  position: fixed;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  z-index: 99;
}
.opened {
  left: 400px;
}
.el-main {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
