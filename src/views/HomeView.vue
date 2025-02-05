<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ResultsMap from '@/components/ResultsMap.vue'
import ResultsMapControls from '@/components/ResultsMapControls.vue'
import type {
  ResultsMapData,
  Bubble,
  Relationship,
  Group,
  LayerType,
} from '@/types/ResultsMap'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import defaultMapData from '@/data/default';

const showAside = ref(true)


const mapData = ref<ResultsMapData | null>(null)

onMounted(() => {
    const localMapData = localStorage.getItem('MapData')
    if (localMapData) {
      console.log('???/')

      mapData.value = JSON.parse(localMapData)

      console.log('LocalMapData:', JSON.parse(localMapData))
    } else {
      mapData.value = defaultMapData
      localStorage.setItem('MapData', JSON.stringify(mapData.value))
    }
})

const addBubble = (bubble: Omit<Bubble, 'id'>) => {
  if(!mapData.value) return
  const newId = Date.now().toString()
  mapData.value.bubbles.push({
    ...bubble,
    id: newId,
    locked: false,
  })
}

const addRelationship = (relationship: Omit<Relationship, 'id'>) => {
  if(!mapData.value) return
  const newId = (mapData.value.relationships.length + 1).toString()
  mapData.value.relationships.push({
    ...relationship,
    id: newId,
  })
}

const addGroup = (group: Omit<Group, 'id'>) => {
  if(!mapData.value) return

  mapData.value.bubbles.forEach(bubble => {
    bubble.locked = false;
  })

  // remove all x and y of group, recover the group's name and divider calculation
  mapData.value.groups.forEach((group) => {
    group.x = undefined
    group.y = undefined
    group.locked = false
  })
  const newId = "G" + (mapData.value.groups.length + 1).toString()
  console.log('GGGG', group);

  mapData.value.groups.push({
    ...group,
    id: newId,
  })
}

const deleteGroup = (index: number) => {
  if(!mapData.value) return

  mapData.value.bubbles.forEach(bubble => {
    bubble.locked = false;
  })

   mapData.value.groups.forEach((group) => {
    group.x = undefined
    group.y = undefined
    group.locked = false
  })

  mapData.value.groups.splice(index, 1)
}

const changeGroupLevel = (groupLevel: LayerType) => {
  if(!mapData.value) return
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

    <el-container class="main-container" v-if="mapData">
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
