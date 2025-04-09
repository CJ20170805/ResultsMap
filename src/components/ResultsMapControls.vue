<script setup lang="ts">
import { ref, onMounted, inject, watch } from 'vue'
import type {
  LayerType,
  RelationType,
  Bubble,
  Relationship,
  Group,
  ResultsMapData,
  ExportType,
} from '@/types/ResultsMap'
//import { mapActions } from 'pinia';
import type { TourGuideClient } from '@sjmc11/tourguidejs/src/Tour'
import { ElTreeV2 } from 'element-plus'

const props = defineProps<{
  onAddBubble: (bubble: Omit<Bubble, 'id'>) => void
  onUpdateBubble: (bubble: Bubble) => void
  onAddRelationship: (relationship: Omit<Relationship, 'id'>) => void
  onAddGroup: (group: Omit<Group, 'id'>) => void
  onDeleteGroup: (groupId: string) => void
  onUpdateGroup: (group: Group) => void
  onChangeGroupLevel: (groupLevel: LayerType) => void
  onExport: (type: ExportType) => void
  onImport: () => void
  onCreateNewMap: () => void
  onContinueTour: () => void
  groups: Group[]
  mapData: ResultsMapData
}>()

const mapConfig = ref(props.mapData.mapConfig)
const legends = ref(props.mapData.legends)
const bubbleData = ref(props.mapData.bubbles)
const groupData = ref(props.groups)

const exportType = ref<ExportType>('png')

const newBubble = ref({
  text: '',
  layer: 'process' as LayerType,
  groupId: '',
})

const groupLevel = ref(props.mapData.groupLevel)

const newGroup = ref({
  name: '',
  //layers: [] as LayerType[],
})

const newRelationship = ref({
  source: '',
  target: '',
  type: 'cause-effect' as RelationType,
})

const layerOptions: LayerType[] = ['mission', 'strategic', 'process', 'operational']
const relationTypes: RelationType[] = ['cause-effect', 'companion', 'conflict', 'lead-lag']

// Tour related state
const currentTab = ref<string>('File')

// Initialize TourGuideJS
const hasSeenTour = localStorage.getItem('hasSeenTour')
const tour = inject<TourGuideClient>('tourGuide')
const isFinished = ref(false)

const startATour = () => {
  // Configure the tour
  if (tour) {
    // restart the tour
    localStorage.removeItem('hasSeenTour')

    const steps = [
      {
        title: 'File Tab',
        content: `This is the File tab where you can create, import, and export maps. <br/><br/>
<strong>Available actions:</strong>
<ul>
  <li><strong>Create:</strong> Start a new map from scratch.</li>
  <li><strong>Import:</strong> Upload a previously saved map file.</li>
  <li><strong>Export:</strong> Download the current map as a file.</li>
  <li><strong>Start Tour:</strong> Begin a guided walkthrough of the app features.</li>
</ul>
`,
        target: '#fileTab',
      },
      {
        title: 'Map Tab',
        content: `This is the Map tab where you can configure map appearance and details. <br/><br/>
<strong>Map customization options:</strong>
<ul>
  <li><strong>Title Input:</strong> Set the title of your map.</li>
  <li><strong>Title Font Size:</strong> Adjust the size of the map title text.</li>
  <li><strong>Title Color:</strong> Pick a color for the map title.</li>
  <li><strong>Bold Title:</strong> Toggle bold styling for the title text.</li>
  <li><strong>Map Date:</strong> Choose a date to display on the map.</li>
  <li><strong>Layer Colors:</strong> Assign colors to different map layers for better visual distinction.</li>
  <li><strong>Group Divider Level:</strong> Set the grouping level for data organization and map rendering.</li>
</ul>
`,
        target: '#mapTab',
      },
      {
        title: 'Legend Tab',
        content: `This is the Legend tab where you can manage the legend for bubbles and lines. <br/><br/>
<strong>Legend customization options:</strong>
<ul>
  <li><strong>Bubbles:</strong> Set the display name for each bubble legend.</li>
  <li><strong>Lines:</strong> Set the name for each line legend and turn their visibility on or off.</li>
</ul>
`,
        target: '#legendTab',
      },
      {
        title: 'Visibility Tab',
        content: `This is the Visibility tab where you can show or hide different parts of the map. <br/><br/>
<strong>What you can do here:</strong>
<ul>
  <li>Use the search filter to quickly find a specific bubble or group by name.</li>
   <li>Use the checkbox tree list to turn bubbles or groups on or off.</li>
</ul>
`,
        target: '#visibilityTab',
      },
    ]

    tour.setOptions({ steps, finishLabel: 'Continue' })

    tour.onBeforeStepChange(() => {
      console.log(`Before Changing to step: ${tour.activeStep}`)
      if (!isFinished.value) {
        switch (tour.activeStep) {
          case 0:
            currentTab.value = 'Map'
            break
          case 1:
            currentTab.value = 'Legend'
            break
          case 2:
            currentTab.value = 'Visibility'
            break
          case 3:
            currentTab.value = 'File'
            break
        }
      }
    })

    tour.onFinish(() => {
      console.log('Tour finished')

      currentTab.value = 'File'

      isFinished.value = true
      props.onContinueTour()
    })

    tour.onBeforeExit(() => {
      console.log('Tour exited 000')
      if (!isFinished.value) {
        localStorage.setItem('hasSeenTour', 'true')
        currentTab.value = 'File'
      }
    })

    tour.start()
  }
}

const reStartATour = () => {
  isFinished.value = false
  startATour()
}

onMounted(() => {
  if (!hasSeenTour && tour) {
    setTimeout(() => {
      startATour()
    }, 1000)
  }
  generateTreeData()
  //updateCheckedKeys()
})

watch(
  () => [props.mapData.bubbles, props.groups],
  () => {
    generateTreeData()
    // updateCheckedKeys()
  },
  { deep: true },
)

const handleAddBubble = () => {
  if (newBubble.value.text.trim()) {
    props.onAddBubble({
      text: newBubble.value.text,
      layer: newBubble.value.layer,
      groupId: newBubble.value.groupId,
      locked: false,
      visible: true,
    })
    newBubble.value.text = ''
  }
}

const handleAddGroup = () => {
  //if (newGroup.value.name !== "") {
  props.onAddGroup({
    name: newGroup.value.name,
    locked: false,
    isDragging: false,
    visible: true,
    //layers: newGroup.value.layers,
  })
  newGroup.value.name = ''
  // newGroup.value.layers = []
  //}
}

const handleAddRelationship = () => {
  if (newRelationship.value.source && newRelationship.value.target) {
    props.onAddRelationship({
      source: newRelationship.value.source,
      target: newRelationship.value.target,
      type: newRelationship.value.type,
    })
    newRelationship.value.source = ''
    newRelationship.value.target = ''
  }
}

const handleGroupLayerChange = () => {
  props.onChangeGroupLevel(groupLevel.value as LayerType)
}

const deleteGroup = (groupId: string) => {
  if (groupId) {
    props.onDeleteGroup(groupId)
    console.log(`Deleted group with ID: ${groupId}`)
  }
}

const handleExport = () => {
  console.log('Exporting map...')
  props.onExport(exportType.value)
}

const handleFileUpload = () => {
  console.log('File uploaded')
  props.onImport()
}

const createNewMap = () => {
  console.log('Creating new map...')
  props.onCreateNewMap()
}

// Visibility Control
const filterText = ref('')
const treeRef = ref<InstanceType<typeof ElTreeV2>>()
const treeData = ref<any[]>([])
let expandedKeys = groupData.value.map((group) => group.id)
console.log('Expanded Keys:', expandedKeys)
const treeProps = ref({
  label: 'name',
  children: 'children',
})

interface Tree {
  [key: string]: any
}

const checkedKeys = ref<string[]>([])

watch(filterText, (val) => {
  treeRef.value!.filter(val)
})

const filterNode = (value: string, data: Tree) => {
  if (!value) return true
  return data.name.includes(value)
}

const updateCheckedKeys = () => {
  const visibleGroupIds = groupData.value.filter((group) => group.visible).map((group) => group.id)

  const visibleBubbleIds = bubbleData.value
    .filter((bubble) => bubble.visible)
    .map((bubble) => bubble.id)

  checkedKeys.value = [...visibleGroupIds, ...visibleBubbleIds]

  treeRef.value!.setCheckedKeys(checkedKeys.value)

  // setTimeout(() => {
  //   treeRef.value!.setExpandedKeys(groupData.value.map((group) => group.id))
  // }, 500)

  // If new group is added, expand it
  if (groupData.value.length > expandedKeys.length) {
    const newGroupIds = visibleGroupIds.filter((id) => !expandedKeys.includes(id))
    const groupNode = treeRef.value!.getNode(newGroupIds[0])
    const bubbleLength = bubbleData.value.filter(
      (bubble) => bubble.groupId === newGroupIds[0],
    ).length
    if (groupNode && bubbleLength > 0) {
      treeRef.value!.expandNode(groupNode)
      expandedKeys.push(newGroupIds[0])
    }
  }
}

const generateTreeData = () => {
  console.log('Generating tree data...')
  // Create a tree structure where groups contain their bubbles
  treeData.value = groupData.value.map((group) => ({
    id: group.id,
    name: group.name || 'untitled-group',
    type: 'group',
    visible: group.visible,
    children: bubbleData.value
      .filter((bubble) => bubble.groupId === group.id) // Filter bubbles for this group
      .map((bubble) => ({
        id: bubble.id,
        name: bubble.text,
        type: 'bubble',
        visible: bubble.visible,
      })),
  }))

  updateCheckedKeys()
}

const handleVisibilityChange = (node: any, checked: boolean) => {
  console.log('Node:', node, 'Checked:', checked)

  if (node.type === 'group') {
    // Update group visibility
    const group = groupData.value.find((g) => g.id === node.id)
    if (group) {
      props.onUpdateGroup({ ...group, visible: checked })
      //group.visible = checked;
    }

    // Update bubble visibility
    const bubbles = bubbleData.value.filter((b) => b.groupId === node.id)
    bubbles.forEach((bubble) => {
      props.onUpdateBubble({ ...bubble, visible: checked })
      //bubble.visible = checked;
    })
  } else if (node.type === 'bubble') {
    // Update bubble visibility
    const bubble = bubbleData.value.find((b) => b.id === node.id)
    if (bubble) {
      props.onUpdateBubble({ ...bubble, visible: checked })
      // bubble.visible = checked;
    }
  }

  // // Update the checkedKeys list
  // updateCheckedKeys();
}

const updateAdjacentLayer = (currentLayer: string) => {
  switch (currentLayer) {
    case 'mission':
      mapConfig.value.layerSizes.strategic.inner = mapConfig.value.layerSizes.mission.outer
      break
    case 'strategic':
      mapConfig.value.layerSizes.process.inner = mapConfig.value.layerSizes.strategic.outer
      break
    case 'process':
      mapConfig.value.layerSizes.operational.inner = mapConfig.value.layerSizes.process.outer

    default:
      break
  }
}
</script>

<template>
  <div class="controls-panel">
    <el-tabs type="card" v-model="currentTab" class="control-tabs">
      <el-tab-pane label="File" name="File" id="fileTab">
        <!-- Import and Export Forms -->
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <!-- <h3>Import & Export Map</h3> -->
              <el-form style="margin: 5px 0 0 0">
                <!-- New Map Form -->
                <el-form-item>
                  <label style="margin: 0 26px 0 0">New Map: </label>
                  <el-button type="primary" @click="createNewMap">Create</el-button>
                </el-form-item>

                <!-- Import Form -->
                <el-form-item>
                  <label style="margin: 0 14px 0 0">Import Map: </label>
                  <el-button type="primary" @click="handleFileUpload">Select a file</el-button>
                </el-form-item>

                <!-- Export Form -->
                <el-form-item>
                  <label style="margin: 0 14px 0 0">Export Map: </label>
                  <el-select
                    v-model="exportType"
                    placeholder="Select export type"
                    style="width: 160px; margin: 0 10px 0 0"
                  >
                    <el-option label="PNG" value="png"></el-option>
                    <el-option label="PDF" value="pdf"></el-option>
                    <el-option label="Source Data" value="json"></el-option>
                  </el-select>
                  <el-button type="primary" @click="handleExport">Export</el-button>
                </el-form-item>

                <!-- Start a tour -->
                <el-form-item>
                  <label style="margin: 0 14px 0 0">Start a Tour: </label>
                  <el-button type="primary" @click="reStartATour">Start</el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Map" name="Map" id="mapTab">
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <!-- <h3>Map Config</h3> -->
              <el-form style="margin: 5px 0 0 0">
                <el-form-item>
                  <label style="margin: 0 14px 0 0">Title: </label>
                  <el-input
                    v-model="mapConfig.title"
                    style="width: 80%"
                    placeholder="Map Title"
                  ></el-input>
                </el-form-item>
                <el-form-item>
                  <label style="margin: 0 14px 0 0">Title Font Size: </label>
                  <!-- <el-input-number
                    v-model="mapConfig.titleFontSize"
                    :min="10"
                    :max="200"
                    style="width: 220px"
                    label="Font Size"
                  ></el-input-number> -->

                  <el-slider
                    style="width: 220px"
                    v-model="mapConfig.titleFontSize"
                    :min="10"
                    :max="300"
                    :step="1"
                  />
                </el-form-item>
                <!-- Add title color picker -->
                <el-form-item>
                  <label style="margin: 0 14px 0 0">Title Color: </label>
                  <el-color-picker v-model="mapConfig.titleColor" />
                </el-form-item>
                <!-- Add title weight toggle -->
                <el-form-item>
                  <label style="margin: 0 14px 0 0">Bold Title: </label>
                  <el-switch
                    v-model="mapConfig.titleFontWeight"
                    active-value="bold"
                    inactive-value="normal"
                  />
                </el-form-item>
                <!--  Date Picker  -->
                <el-form-item>
                  <label style="margin: 0 42px 0 0">Map Date: </label>
                  <el-date-picker
                    v-model="mapConfig.date"
                    type="date"
                    placeholder="Pick a date"
                    format="DD MMMM YYYY"
                    value-format="YYYY-MM-DD"
                  ></el-date-picker>
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>
        <!-- Add Layer Size Controls -->
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Layer Sizes</h3>
              <el-form>
                <!-- Mission Layer (innermost) -->
                <el-form-item label="Mission">
                  <el-slider
                    v-model="mapConfig.layerSizes.mission.outer"
                    :min="0"
                    :max="1000"
                    :step="10"
                    show-input
                    @change="() => updateAdjacentLayer('mission')"
                  />
                </el-form-item>

                <!-- Strategic Layer -->
                <el-form-item label="Strategic ">
                  <el-slider
                    v-model="mapConfig.layerSizes.strategic.outer"
                    :min="mapConfig.layerSizes.mission.outer"
                    :step="10"
                    :max="1000"
                    show-input
                    @change="() => updateAdjacentLayer('strategic')"
                  />
                </el-form-item>

                <!-- Process Layer -->
                <el-form-item label="Process">
                  <el-slider
                    v-model="mapConfig.layerSizes.process.outer"
                    :min="mapConfig.layerSizes.strategic.outer"
                    :step="10"
                    :max="1000"
                    show-input
                    @change="() => updateAdjacentLayer('process')"
                  />
                </el-form-item>

                <!-- Operational Layer (outermost) -->
                <el-form-item label="Operational">
                  <el-slider
                    v-model="mapConfig.layerSizes.operational.outer"
                    :min="mapConfig.layerSizes.process.outer + 10"
                    :max="1000"
                    :step="10"
                    show-input
                  />
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Layer Colors</h3>
              <el-form class="color-form">
                <el-form-item v-for="(color, layer) in mapConfig.layerColors" :key="layer">
                  <label class="color-label" :for="layer">{{ layer }}</label>
                  <el-color-picker v-model="mapConfig.layerColors[layer]" />
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Group Divider Level</h3>
              <el-select
                v-model="groupLevel"
                placeholder="Select Group Level"
                @change="handleGroupLayerChange"
              >
                <el-option label="None" value="None"></el-option>
                <el-option
                  v-for="layer in layerOptions"
                  :key="layer"
                  :label="layer"
                  :value="layer"
                ></el-option>
              </el-select>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Divider Settings</h3>
              <el-form>
                <!-- Divider Color -->
                <el-form-item label="Divider Color">
                  <el-color-picker v-model="mapConfig.dividerColor" />
                </el-form-item>
                <!-- Divider Width -->
                <el-form-item label="Divider Width">
                  <el-slider
                    v-model="mapConfig.dividerWidth"
                    :min="1"
                    :max="10"
                    :step="1"
                    show-input
                  />
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Group" v-if="false">
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Groups</h3>
              <el-form>
                <el-form-item v-for="(group, index) in groups" :key="group.id">
                  <el-row :gutter="10">
                    <el-col :span="5">
                      <span>Group {{ index + 1 }}</span>
                    </el-col>
                    <el-col :span="15">
                      <el-input v-model="group.name" placeholder="Group Name"></el-input>
                    </el-col>
                    <el-col :span="2">
                      <el-button type="danger" @click="deleteGroup(group.id)">Delete</el-button>
                    </el-col>
                  </el-row>
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Add New Group</h3>
              <el-form>
                <el-form-item>
                  <el-input v-model="newGroup.name" placeholder="Group name"></el-input>
                </el-form-item>
                <!-- <el-form-item>
                  <el-select v-model="newGroup.layers" multiple placeholder="Select Layers">
                    <el-option
                      v-for="layer in layerOptions"
                      :key="layer"
                      :label="layer"
                      :value="layer"
                    ></el-option>
                  </el-select>
                </el-form-item> -->
                <el-form-item>
                  <el-button type="primary" @click="handleAddGroup">Add Group</el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Group Divider Level</h3>
              <el-select
                v-model="groupLevel"
                placeholder="Select Group Level"
                @change="handleGroupLayerChange"
              >
                <el-option label="None" value="None"></el-option>
                <el-option
                  v-for="layer in layerOptions"
                  :key="layer"
                  :label="layer"
                  :value="layer"
                ></el-option>
              </el-select>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Bubble" v-if="false">
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Add New Bubble</h3>
              <el-form>
                <el-form-item>
                  <el-input v-model="newBubble.text" placeholder="Bubble text"></el-input>
                </el-form-item>
                <el-form-item>
                  <el-select v-model="newBubble.layer" placeholder="Select Layer">
                    <el-option
                      v-for="layer in layerOptions"
                      :key="layer"
                      :label="layer"
                      :value="layer"
                    ></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item v-if="props.groups.length">
                  <el-select v-model="newBubble.groupId" placeholder="Select Group">
                    <el-option value="">No Group</el-option>
                    <el-option
                      v-for="(group, index) in props.groups"
                      :key="group.id"
                      :label="group.name || `Group ${index + 1}`"
                      :value="group.id"
                    ></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="handleAddBubble">Add Bubble</el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Relationship" v-if="false">
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Add New Relationship</h3>
              <el-form>
                <el-form-item>
                  <el-select v-model="newRelationship.source" placeholder="Select Source">
                    <el-option
                      v-for="bubble in props.mapData.bubbles"
                      :key="bubble.id"
                      :label="bubble.text"
                      :value="bubble.id"
                    ></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-select v-model="newRelationship.target" placeholder="Select Target">
                    <el-option
                      v-for="bubble in props.mapData.bubbles"
                      :key="bubble.id"
                      :label="bubble.text"
                      :value="bubble.id"
                    ></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-select v-model="newRelationship.type" placeholder="Select Type">
                    <el-option
                      v-for="type in relationTypes"
                      :key="type"
                      :label="type"
                      :value="type"
                    ></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="handleAddRelationship"
                    >Add Relationship</el-button
                  >
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Legend" name="Legend" id="legendTab">
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Bubbles</h3>
              <el-form>
                <el-form-item v-for="legend in legends.legendBubbles" :key="legend.track">
                  <el-input v-model="legend.text" placeholder="Legend Text"></el-input>
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Lines</h3>
              <el-form>
                <el-form-item v-for="legend in legends.legendLines" :key="legend.type">
                  <el-col :span="20">
                    <el-input v-model="legend.text" placeholder="Legend Text"></el-input>
                  </el-col>
                  <el-col :span="4">
                    <el-switch v-model="legend.visible"></el-switch>
                  </el-col>
                </el-form-item>
              </el-form>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
      <el-tab-pane label="Visibility" name="Visibility" id="visibilityTab">
        <el-row :gutter="20">
          <el-col :span="24">
            <div class="control-section">
              <h3>Visibility Control</h3>
              <el-input
                style="margin: 0 0 10px 0"
                v-model="filterText"
                class="w-60 mb-2"
                placeholder="Filter keyword"
              />
              <el-tree-v2
                ref="treeRef"
                :data="treeData"
                show-checkbox
                :props="treeProps"
                default-expand-all
                hiligh-current
                check-strictly
                :default-checked-keys="checkedKeys"
                :default-expanded-keys="expandedKeys"
                @check-change="handleVisibilityChange"
                :filter-method="filterNode"
                :height="600"
              />
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>

    <!-- Tour Dialogue -->
    <!-- <el-tour
      v-model="showTour"
      :z-index="2005"
      @finish="handleTourFinish"
      @change="handleTourChange"
    >
      <el-tour-step
        v-for="(step, index) in tourSteps"
        :key="index"
        :target="step.target"
        :title="step.title"
        :description="step.description"
        @close="handleStepClose"
      />
    </el-tour> -->
  </div>
</template>

<style>
.control-tabs > .el-tabs__content {
  padding: 2px 12px;
}
.control-tabs .el-tabs__nav {
  width: 100%;
}
.control-tabs .el-tabs__item {
  width: 33%;
}
.el-form-item {
  margin-bottom: 10px;
}
</style>

<style scoped>
.controls-panel {
  /* padding: 1rem; */
  border-radius: 4px;
  margin-bottom: 1rem;
}

.controls-panel h3 {
  margin: 0 0 10px 0;
}

.control-section {
  margin-bottom: 1rem;
}

.el-row {
  margin: 0 0 10px 0;
}

.form-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
span {
  display: inline-block;
  line-height: 40px;
}

select[multiple] {
  height: 100px;
}

.color-label {
  text-transform: capitalize;
  margin: 0 10px 0 0px;
}
</style>
