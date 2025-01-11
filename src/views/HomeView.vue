<!--
 * @Author: GaryCho honor1998321@gmail.com
 * @Date: 2025-01-05 15:15:17
 * @LastEditors: GaryCho honor1998321@gmail.com
 * @LastEditTime: 2025-01-11 13:52:30
 * @FilePath: /ResultsMap/src/views/HomeView.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
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
