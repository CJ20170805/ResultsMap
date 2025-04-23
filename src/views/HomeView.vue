<script setup lang="ts">
import { ref, onMounted, watch, inject, onUpdated } from 'vue'
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
import type { TourGuideClient } from '@sjmc11/tourguidejs/src/Tour'

const showAside = ref(true)

const mapData = ref<ResultsMapData | null>(null)
const ResultsMapRef = ref<InstanceType<typeof ResultsMap> | null>(null)
const showFileDialog = ref(false)

// Define the tour steps
const tour = inject<TourGuideClient>('tourGuide')

// Check if the user has seen the tour before
const hasSeenTour = localStorage.getItem('hasSeenTour')
const tourSteps = [
  {
    target: '#loadButton',
    title: 'Load Map',
    content: 'Click this button to load an existing map file.',
  },
  {
    target: '#newButton',
    title: 'New Map',
    content: 'Click this button to create a new map file.',
  },
]

const startATour = async () => {
  console.log('startATour', tour, hasSeenTour)

  if (tour) {
    tour.setOptions({ steps: tourSteps })
    if (!hasSeenTour) {
      tour.start()
    }
  }
}

const continueTour = () => {
  setTimeout(() => {
    ResultsMapRef.value?.startATour()
  }, 300)
}

onMounted(async () => {
  const fileName = localStorage.getItem('fileHandleName')
  if (fileName) {
    // Check if the session flag exists
    const isSameTab = sessionStorage.getItem('isSameTab') === 'true'

    if (isSameTab) {
      // Same tab (refresh), load the file directly
      await handleContinueWorking()
    } else {
      // New tab, show the dialog
      const confirmContinue = await ElMessageBox.confirm(
        `Do you want to continue working on "${fileName}"?`, // message
        {
          title: 'Continue Working', // title is part of options
          confirmButtonText: 'Continue',
          cancelButtonText: 'Start New',
          distinguishCancelAndClose: true,
          closeOnClickModal: false,
          showClose: false,
          //top: '30vh',
          // modalClass: 'custom-modal-class',
          customClass: 'custom-message-box-class',
        },
      ).catch(() => false)

      if (confirmContinue) {
        // User confirmed, load the file
        await handleContinueWorking()
      } else {
        // User declined, clear the saved file name
        removeFileHandleToLocalStorage()
        resetPage()
        showFileDialog.value = true // Show the file dialog for new/import options
      }
    }
  } else {
    // No file name found, show the default dialog
    showFileDialog.value = true
    // Start the tour
    setTimeout(() => {
      startATour()
    }, 600)
  }

  // Set the session flag to indicate the tab is open
  sessionStorage.setItem('isSameTab', 'true')
  checkUpdates();
})

// onMounted(() => {
//   // Clear the session flag when the tab is closed or refreshed
//   window.addEventListener('beforeunload', () => {
//     sessionStorage.removeItem('isSameTab');
//   });
// });

// Utility function to debounce a function call
const debounce = (func: (...args: any[]) => void, delay: number): ((...args: any[]) => void) => {
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
  //mapData.value = defaultMapData;
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

const updateBubble = (bubble: Bubble) => {
  if (!mapData.value) return
  const index = mapData.value.bubbles.findIndex((b) => b.id === bubble.id)
  if (index !== -1) {
    mapData.value.bubbles[index] = bubble
  }
}

const updateGroup = (group: Group) => {
  if (!mapData.value) return

  // unlock group
  mapData.value.groups.forEach((g) => {
    g.locked = false
    g.isDragging = true // For recalculate the group name
  })

  // unlock bubble
  mapData.value.bubbles.forEach((g) => {
    g.locked = false
  })

  // update group
  const index = mapData.value.groups.findIndex((g) => g.id === group.id)
  if (index !== -1) {
    mapData.value.groups[index].visible = group.visible;
  }


  // recovery status
  setTimeout(() => {
    if (mapData.value) {
      mapData.value.groups.forEach((g) => {
        g.locked = false
        g.isDragging = false
      })
    }
  }, 300)
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
    bubble.locked = true
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
    bubble.locked = true
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
  importMapFromFile()
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
    console.log('Permission:', permission)

    if (permission === 'granted') {
      const file = await fileHandleInstance.getFile()
      const fileContent = await file.text()
      mapData.value = JSON.parse(fileContent)
      console.log('Map data loaded from file:', mapData.value)
    } else {
      console.error('Permission denied')
      //resetPage()
      // show a comfirm to request permission again
      await ElMessageBox.confirm(
        `Permission to access the file was denied. Do you want to try again?`, // message
        {
          title: 'Permission Denied', // title is part of options
          confirmButtonText: 'Try Again',
          cancelButtonText: 'Cancel',
          distinguishCancelAndClose: true,
          closeOnClickModal: false,
          showClose: false,
          customClass: 'custom-message-box-class',
        },
      )
        .then(() => {
          handleContinueWorking()
        })
        .catch(() => false)
    }
  } catch (error) {
    console.error('Error loading file:', error)
    // Notify the user that an error occurred
    resetPage()
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

const resetPage = () => {
  console.log('ResetPage')

  //removeFileHandleToLocalStorage()
  window.location.reload()
}

// Save map data to file
const saveMapDataToFile = async (createNew: boolean = false) => {
  console.log('Current file handle:', currentFileHandle.value)
  console.log('Current map data:', mapData.value)
  console.log('Default map data:', defaultMapData)

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
  // Check if the method is available
  if (!window.showSaveFilePicker) {
    throw new Error('File System Access API is not supported in this browser.')
  }

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
      mapData.value = JSON.parse(JSON.stringify(defaultMapData))
      console.log('New map data:', mapData.value, defaultMapData)
    }, 100)
  } catch (error) {
    console.error('Error creating new map:', error)
    resetPage()
  }
}

const importMapFromFile = async () => {
  console.log('importMapFromFile')
  // Check if the method is available
  if (!window.showOpenFilePicker) {
    throw new Error('File System Access API is not supported in this browser.')
  }
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

      checkUpdates();
    } else {
      console.error('Permission denied')
      // Notify the user that access was denied
      ElMessageBox.alert('Permission to access the file was denied.', 'Permission Denied', {
        confirmButtonText: 'OK',
      }).then(() => {
        resetPage()
      })
    }
  } catch (error) {
    console.error('Error loading file:', error)
    // Notify the user that an error occurred
    // ElMessageBox.alert('An error occurred while loading the file.', 'Error', {
    //   confirmButtonText: 'OK',
    // }).then(() => {
    //   resetPage();
    // })
    resetPage()
  }
}

const resetDataToDefault = () => {
  saveMapDataToFile(true)
  console.log('resetDataToDefault', mapData.value, defaultMapData)

  //update the ResultsMap component
  mapData.value = null
  setTimeout(() => {
    mapData.value = JSON.parse(JSON.stringify(defaultMapData))
  }, 300)
}

const checkUpdates = () => {
  if (!mapData.value) return;

  const hasOutdatedLegends = mapData.value.legends.legendBubbles.some(
    (bubble) => bubble.cx !== 60
  ) || mapData.value.legends.legendLines.some((line) => line.x !== 60);

  if (hasOutdatedLegends) {
    ElMessageBox.alert(
      'Your map file contains outdated legend settings. Please click the "Update" button to apply the latest updates.',
      'Update Required',
      {
        confirmButtonText: 'Update',
        type: 'warning',
      }
    ).then(() => {

      if (mapData.value && mapData.value.legends) {
         // Update legendBubbles
        mapData.value.legends.legendBubbles.forEach((bubble) => {
          if (bubble.cx !== 60) bubble.cx = 60;
        });

        // Update legendLines
        mapData.value.legends.legendLines.forEach((line) => {
          if (line.x !== 60) line.x = 60;
        });
      }

      console.log('Legend settings updated to defaults.');
    });
  }
};

</script>

<template>
  <div class="home-container">
    <el-container class="main-container" v-if="mapData">
      <el-aside v-show="showAside" width="400px">
        <div class="aside-container">
          <ResultsMapControls
            :mapData="mapData"
            :onAddBubble="addBubble"
            :onUpdateBubble="updateBubble"
            :onUpdateGroup="updateGroup"
            :onAddRelationship="addRelationship"
            :onAddGroup="addGroup"
            :onDeleteGroup="deleteGroup"
            :groups="mapData.groups"
            :onChangeGroupLevel="changeGroupLevel"
            :onExport="exportMap"
            :onImport="importMap"
            :onCreateNewMap="createNewMap"
            :onContinueTour="continueTour"
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
        <ResultsMap
          ref="ResultsMapRef"
          :data="mapData"
          :onAddGroup="addGroup"
          :onResetDataToDefault="resetDataToDefault"
        />
      </el-main>
    </el-container>

    <el-dialog
      v-model="showFileDialog"
      title="Welcome to Results Map Builder"
      width="30%"
      top="32vh"
      modal-class="custom-modal-class"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :z-index="1000"
    >
      <span>Select an option to continue:</span>
      <template #footer>
        <el-space>
          <el-button id="loadButton" type="" @click="handleLoadFile">Load Map</el-button>
          <el-button id="newButton" type="primary" @click="handleCreateNewFile">New Map</el-button>
        </el-space>
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
