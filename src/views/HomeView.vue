<script setup lang="ts">
import { ref } from 'vue'
import ResultsMap from '@/components/ResultsMap.vue'
import ResultsMapControls from '@/components/ResultsMapControls.vue'
import type { ResultsMapData, Bubble, Relationship, Group, LayerType, MapConfig } from '@/types/ResultsMap'
import type { DrawerProps } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight
} from '@element-plus/icons-vue'

const showAside = ref(true)

const mapData = ref<ResultsMapData>({
  mapConfig:{
    title: 'Results Map',
    fontSize: 28
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
    { id: '1', name: 'G1', startAngle: 0, endAngle: 2, layers: ['process'] },
    { id: '2', name: 'G2', startAngle: 2, endAngle: 4, layers: ['process'] },
    { id: '3', name: 'GROUP3 WITH A LONG NAME', startAngle: 4, endAngle: 6, layers: ['process'] },
  ],
  groupLevel: 'process',
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
            :groups="mapData.groups"
            :onChangeGroupLevel="changeGroupLevel"
          />
        </div>
      </el-aside>
      <el-button class="toggle-button" :class="{ opened: showAside }" :icon="showAside? ArrowLeft: ArrowRight" @click="toggleAside">
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
.el-main{
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
