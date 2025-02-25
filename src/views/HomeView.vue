<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import ResultsMap from '@/components/ResultsMap.vue'
import ResultsMapControls from '@/components/ResultsMapControls.vue'
import type {
  ResultsMapData,
  Bubble,
  Relationship,
  Group,
  LayerType,
  ExportType,
} from '@/types/ResultsMap'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import defaultMapData from '@/data/default'
import { ElMessageBox } from 'element-plus'
import { map } from 'd3'

const showAside = ref(true)

const mapData = ref<ResultsMapData | null>(null)
const ResultsMapRef = ref<InstanceType<typeof ResultsMap> | null>(null)
const showFileDialog = ref(false)

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

  // Check if a file handle is stored in localStorage
  //const fileHandleName = localStorage.getItem('fileHandleName');
  // if (fileHandleName) {
  //   // Inform the user that they need to reload the file
  //   console.log('A file handle is stored. Please reload the file.');
  // } else {
  //   // No file handle found, prompt the user to create or import a file
  //   promptUserForFile();
  // }

  const fileName = localStorage.getItem('fileHandleName')
  console.log('current fileName: ', fileName)
  if (fileName) {
    // Show the dialog with the specific file name
    //showFileDialog.value = true;
    handleContinueWorking()
  } else {
    // No file name found, show the default dialog
    showFileDialog.value = true
  }
})

// Utility function to debounce a function call
const debounce = (func: Function, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: any[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

// Debounced auto-save function
const autoSave = debounce(async () => {
  if (mapData.value) {
    console.log('Auto-saving map data...')
    await saveMapDataToFile(false)
  }
}, 2000)

// Watch for changes in mapData
watch(
  () => mapData.value,
  () => {
    autoSave() // Trigger the debounced auto-save function
  },
  { deep: true }, // Deep watch to detect nested changes
)

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

const exportMap = async (type: ExportType) => {
  await ResultsMapRef.value?.resetZoom()
  switch (type) {
    case 'png':
      ResultsMapRef.value?.exportMapAsImage()
      break
    case 'pdf':
      ResultsMapRef.value?.exportMapAsPDF()
      break
    case 'json':
      ResultsMapRef.value?.exportMapAsJson()
      break
    default:
      break
  }
}

const importMap = () => {
  console.log('importMap')

  // const reader = new FileReader()
  // reader.onload = (e) => {
  //   const result = e.target?.result
  //   if (typeof result === 'string') {
  //     mapData.value = JSON.parse(result)
  //     localStorage.setItem('MapData', JSON.stringify(mapData.value))
  //   }
  // }
  // reader.readAsText(file)
  importMapFromFile()
}

// Generate the dialog message dynamically
const getDialogMessage = () => {
  const fileName = localStorage.getItem('fileHandleName')
  if (fileName) {
    return `Do you want to continue working on ${fileName}?`
  } else {
    return 'Do you want to load an existing file or create a new one?'
  }
}

// Handle "Continue Working" or "Load File" button click
const handleLoadFile = async () => {
  showFileDialog.value = false // Close the dialog
  importMapFromFile()
}

// Handle "Create New File" button click
const handleCreateNewFile = async () => {
  showFileDialog.value = false // Close the dialog
  await createNewMap() // Call the createNewMap function
}

// Handle dialog close
const handleDialogClose = () => {
  showFileDialog.value = false
}

// Handle "Continue Working" button click
const handleContinueWorking = async () => {
  showFileDialog.value = false // Close the dialog

  try {
    const fileName = localStorage.getItem('fileHandleName')
    if (!fileName) {
      console.error('No file name found in localStorage.')
      return
    }

    const fileHandleInstance = await getFileHandleFromIndexedDB(fileName)
    currentFileHandle.value = fileHandleInstance

    // Request permission to access the file
    const permission = await fileHandleInstance.requestPermission({ mode: 'readwrite' })
    if (permission === 'granted') {
      const file = await fileHandleInstance.getFile()
      const fileContent = await file.text()
      mapData.value = JSON.parse(fileContent)
      console.log('Map data loaded from file:', mapData.value)
    } else {
      console.error('Permission denied')
      // Notify the user that access was denied
    }
  } catch (error) {
    console.error('Error loading file:', error)
    // Notify the user that an error occurred
  }
}

// Create a new map

const currentFileHandle = ref<FileSystemFileHandle | null>(null)

// Save the file name to localStorage
const saveFileHandleToLocalStorage = (fileHandle: FileSystemFileHandle) => {
  console.log('saveFileHandleToLocalStorage', fileHandle)
  localStorage.setItem('fileHandleName', fileHandle.name)
}

// Remove the file name from the localstorage
const removeFileHandleToLocalStorage = () => {
  console.log('removeFileHandleToLocalStorage')
  localStorage.removeItem('fileHandleName')
}

// Save map data to file
const saveMapDataToFile = async (createNew: boolean = false) => {
  console.log('Current file handle:', currentFileHandle.value)
  console.log('Current map data:', mapData.value)

  if (!currentFileHandle.value) {
    console.warn('No file handle available.')
    return
  }

  try {
    const writable = await currentFileHandle.value.createWritable()
    const jsonData = JSON.stringify(createNew ? defaultMapData : mapData.value, null, 2)
    console.log('jsonData', createNew ? defaultMapData : mapData.value, createNew)

    await writable.write(jsonData)
    await writable.close()
    console.log('Map data saved to file.')
  } catch (error) {
    console.error('Error saving map data:', error)
    currentFileHandle.value = null
  }
}

// Open IndexedDB
const openIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ResultsMapDB', 1)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('fileHandles')) {
        db.createObjectStore('fileHandles', { keyPath: 'name' })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

const saveFileHandleToIndexedDB = async (fileHandle: FileSystemFileHandle) => {
  const db = await openIndexedDB()
  const transaction = db.transaction('fileHandles', 'readwrite')
  const store = transaction.objectStore('fileHandles')

  return new Promise<void>((resolve, reject) => {
    const request = store.put({ name: fileHandle.name, handle: fileHandle })

    request.onsuccess = () => {
      console.log('File handle saved to IndexedDB.')
      resolve()
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

const getFileHandleFromIndexedDB = async (fileName: string): Promise<FileSystemFileHandle> => {
  const db = await openIndexedDB()
  const transaction = db.transaction('fileHandles', 'readonly')
  const store = transaction.objectStore('fileHandles')

  return new Promise((resolve, reject) => {
    const request = store.get(fileName)

    request.onsuccess = () => {
      if (request.result) {
        console.log('File handle loaded from IndexedDB.')
        resolve(request.result.handle)
      } else {
        reject(new Error('File handle not found in IndexedDB.'))
      }
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

// Create a new file
const createNewMap = async () => {
  try {
    // Prompt the user to save a new file
    currentFileHandle.value = await window.showSaveFilePicker({
      suggestedName: 'untitled-map.resultsmap',
      types: [
        {
          description: 'Results Map',
          accept: { 'application/json': ['.resultsmap'] },
        },
      ],
    })

    // Save the file name to localStorage
    if (currentFileHandle.value) {
      saveFileHandleToLocalStorage(currentFileHandle.value)
    }

    // Save the default data to the new file
    await saveMapDataToFile(true)

    // Save the file handle to IndexedDB
    await saveFileHandleToIndexedDB(currentFileHandle.value as FileSystemFileHandle)
    console.log('New map file created and saved.')

    mapData.value = null

    // Initialize with default data
    setTimeout(() => {
      mapData.value = defaultMapData
      console.log('New map data:', mapData.value, defaultMapData)
      // Force update the ResultsMap component
      //ResultsMapRef.value?.$forceUpdate()
    }, 100)
  } catch (error) {
    console.error('Error creating new map:', error)
  }
}

const importMapFromFile = async () => {
  console.log('importMapFromFile')
  try {
    // Prompt the user to select a file
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Results Map',
          accept: { 'application/json': ['.resultsmap'] },
        },
      ],
    })

    mapData.value = null

    currentFileHandle.value = fileHandle

    // Save the file name to localStorage
    saveFileHandleToLocalStorage(fileHandle)

    // Save the file handle to IndexedDB
    await saveFileHandleToIndexedDB(fileHandle)

    // Request permission to access the file
    const permission = await fileHandle.requestPermission({ mode: 'readwrite' })
    if (permission === 'granted') {
      const file = await fileHandle.getFile()
      const fileContent = await file.text()
      mapData.value = JSON.parse(fileContent)
      console.log('Map data loaded from file:', mapData.value)

      // Force update the ResultsMap component
      ResultsMapRef.value?.$forceUpdate()
    } else {
      console.error('Permission denied')
      // Notify the user that access was denied
      ElMessageBox.alert('Permission to access the file was denied.', 'Permission Denied', {
        confirmButtonText: 'OK',
      }).then(() => {
        //Clear file name and reload page
        removeFileHandleToLocalStorage()
        window.location.reload()
      })
    }
  } catch (error) {
    console.error('Error loading file:', error)
    // Notify the user that an error occurred
    await ElMessageBox.alert('An error occurred while loading the file.', 'Error', {
      confirmButtonText: 'OK',
    })
  }
}

const promptUserForFile = async () => {
  ElMessageBox.confirm(
    'No map file found. Do you want to create a new file or import an existing one?',
    'Map File Not Found',
    {
      confirmButtonText: 'Create New',
      cancelButtonText: 'Import',
      distinguishCancelAndClose: true,
    },
  )
    .then(async () => {
      await createNewMap()
    })
    .catch(async () => {
      await importMapFromFile()
    })
}

const getFileHandleFromLocalStorage = async () => {
  const fileName = localStorage.getItem('fileHandleName')
  if (!fileName) return null

  try {
    // Prompt the user to select the file again
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Results Map',
          accept: { 'application/json': ['.json'] },
        },
      ],
      suggestedName: fileName, // Suggest the file name
    })
    return fileHandle
  } catch (error) {
    console.error('Error reacquiring file handle:', error)
    return null
  }
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

    <el-dialog
      v-model="showFileDialog"
      title="Welcome to Results Map Builder"
      width="30%"
      :show-close="false"
    >
      <span>Select an option to continue:</span>
      <template #footer>
        <el-button type="primary" @click="handleLoadFile">Load Map</el-button>
        <el-button type="success" @click="handleCreateNewFile">New Map</el-button>
      </template>
    </el-dialog>
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
