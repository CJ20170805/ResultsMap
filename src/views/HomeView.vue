<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ResultsMap from '@/components/ResultsMap.vue'
import ResultsMapControls from '@/components/ResultsMapControls.vue'
import type { ResultsMapData, Bubble, Relationship, Group, LayerType, ExportType } from '@/types/ResultsMap'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import defaultMapData from '@/data/default'
import { ElMessageBox } from 'element-plus';

const showAside = ref(true)

const mapData = ref<ResultsMapData | null>(null)
const ResultsMapRef = ref<InstanceType<typeof ResultsMap> | null>(null);

onMounted(async () => {
  // const localMapData = localStorage.getItem('MapData')
  // if (localMapData) {
  //   console.log('???/')

  //   mapData.value = JSON.parse(localMapData)

  //   console.log('LocalMapData:', JSON.parse(localMapData))
  // } else {
  //   mapData.value = defaultMapData
  //   localStorage.setItem('MapData', JSON.stringify(mapData.value))
  // }

  try {
    // Try to get the file handle from localStorage
    fileHandle.value = await getFileHandleFromLocalStorage();
    if (fileHandle.value) {
      // Read the file content
      const file = await fileHandle.value.getFile();
      const fileContent = await file.text();
      mapData.value = JSON.parse(fileContent);
      console.log('Map data loaded from file:', mapData.value);
    } else {
      // No file handle found, prompt the user
      promptUserForFile();
    }
  } catch (error) {
    console.error('Error loading map data:', error);
    promptUserForFile();
  }
})

const addBubble = (bubble: Omit<Bubble, 'id'>) => {
  if (!mapData.value) return
  const newId = Date.now().toString()
  mapData.value.bubbles.push({
    ...bubble,
    id: newId,
    locked: false,
  })
}

const addRelationship = (relationship: Omit<Relationship, 'id'>) => {
  if (!mapData.value) return
  const newId = Date.now().toString()
  mapData.value.relationships.push({
    ...relationship,
    id: newId,
  })
}

const addGroup = (group: Omit<Group, 'id'>) => {
  if (!mapData.value) return

  mapData.value.bubbles.forEach((bubble) => {
    bubble.locked = false
  })

  // remove all x and y of group, recover the group's name and divider calculation
  mapData.value.groups.forEach((group) => {
    group.x = undefined
    group.y = undefined
    group.locked = false
  })
  const newId = Date.now().toString()
  console.log('GGGG', group)

  mapData.value.groups.push({
    ...group,
    id: newId,
  })
}

const deleteGroup = (groupId: string) => {
  if (!mapData.value) return

  // Get the group to be deleted
  const groupToDelete = mapData.value.groups.find((g) => g.id === groupId)
  if (!groupToDelete) return

  mapData.value.bubbles.forEach((bubble) => {
    bubble.locked = false
  })

  mapData.value.groups.forEach((group) => {
    group.x = undefined
    group.y = undefined
    group.locked = false
  })

  // Delete all bubbles belonging to the group
  mapData.value.bubbles = mapData.value.bubbles.filter(
    (bubble) => bubble.groupId !== groupToDelete.id,
  )

  // Delete all relationships involving bubbles from the group
  mapData.value.relationships = mapData.value.relationships.filter((relationship) => {
    if (mapData.value) {
      // Check if the source or target of the relationship is a bubble in the group
      const sourceBubble = mapData.value.bubbles.find((bubble) => bubble.id === relationship.source)
      const targetBubble = mapData.value.bubbles.find((bubble) => bubble.id === relationship.target)
      // Keep the relationship only if neither source nor target is in the group
      return sourceBubble && targetBubble
    }
  })

  // Delete the group itself
  mapData.value.groups = mapData.value.groups.filter((group) => group.id !== groupId)
}

const changeGroupLevel = (groupLevel: LayerType) => {
  if (!mapData.value) return
  mapData.value.groupLevel = groupLevel
  console.log('changeGroupLevel', groupLevel)
}

const toggleAside = () => {
  showAside.value = !showAside.value
}

const  exportMap = async (type: ExportType) => {
  await ResultsMapRef.value?.resetZoom();
  switch (type) {
    case 'png':
     ResultsMapRef.value?.exportMapAsImage();
      break
    case 'pdf':
      ResultsMapRef.value?.exportMapAsPDF();
      break
    case 'json':
      ResultsMapRef.value?.exportMapAsJson();
      break
    default:
      break
  }
}

const importMap = (file: File) => {
  console.log('importMap', file);

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result
    if (typeof result === 'string') {
      mapData.value = JSON.parse(result)
      localStorage.setItem('MapData', JSON.stringify(mapData.value))
    }
  }
  reader.readAsText(file)
}

// Create a new map

const fileHandle = ref<FileSystemFileHandle | null>(null);

// Save map data to file
const saveMapDataToFile = async (createNew:boolean = false) => {
  if (!fileHandle.value) {
    console.warn('No file handle available.');
    return;
  }

  try {
    const writable = await fileHandle.value.createWritable();
    const jsonData = JSON.stringify(createNew ? defaultMapData : mapData.value, null, 2);
    await writable.write(jsonData);
    await writable.close();
    console.log('Map data saved to file.');
  } catch (error) {
    console.error('Error saving map data:', error);
    fileHandle.value = null;
  }
};

// Create a new file
const createNewMap = async () => {
  try {
    // Prompt the user to save a new file
    fileHandle.value = await window.showSaveFilePicker({
      suggestedName: 'results-map.json',
      types: [
        {
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });

   // Save the file name to localStorage
   if (fileHandle.value) {
    saveFileHandleToLocalStorage(fileHandle.value);
   }


    // Initialize with default data
    mapData.value = defaultMapData;

    // Save the default data to the new file
    await saveMapDataToFile();
    console.log('New map file created and saved.');
  } catch (error) {
    console.error('Error creating new map:', error);
  }
};

const importMapFromFile = async () => {
  console.log("importMapFromFile");

  try {
    // Prompt the user to select a file
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });

    console.log('File handle- import:', fileHandle);

    // Save the file name to localStorage
    saveFileHandleToLocalStorage(fileHandle);

    // Read the file content
    const file = await fileHandle.getFile();
    const fileContent = await file.text();
    mapData.value = JSON.parse(fileContent);
    console.log('Map data imported from file:', mapData.value);
  } catch (error) {
    console.error('Error importing map data:', error);
  }
};

const promptUserForFile = async () => {
  ElMessageBox.confirm(
    'No map file found. Do you want to create a new file or import an existing one?',
    'Map File Not Found',
    {
      confirmButtonText: 'Create New',
      cancelButtonText: 'Import',
      distinguishCancelAndClose: true,
    },
  ).then(async() => {
    await createNewMap();
  }).catch(async() => {
    await importMapFromFile();
  });
};

const saveFileHandleToLocalStorage = (fileHandle: FileSystemFileHandle) => {
  localStorage.setItem('fileHandleName', fileHandle.name);
};

const getFileHandleFromLocalStorage = async () => {
  const fileName = localStorage.getItem('fileHandleName');
  if (!fileName) return null;

  try {
    // Prompt the user to select the file again
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] },
        },
      ],
      suggestedName: fileName, // Suggest the file name
    });
    return fileHandle;
  } catch (error) {
    console.error('Error reacquiring file handle:', error);
    return null;
  }
};
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
            :onExport="exportMap"
            :onImport="importMap"
            :onCreateNewMap="createNewMap"
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
        <ResultsMap ref="ResultsMapRef" :data="mapData" :onAddGroup="addGroup" />
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
