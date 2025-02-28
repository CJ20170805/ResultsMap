<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
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

const props = defineProps<{
  onAddBubble: (bubble: Omit<Bubble, 'id'>) => void
  onAddRelationship: (relationship: Omit<Relationship, 'id'>) => void
  onAddGroup: (group: Omit<Group, 'id'>) => void
  onDeleteGroup: (groupId: string) => void
  onChangeGroupLevel: (groupLevel: LayerType) => void
  onExport: (type: ExportType) => void
  onImport: () => void
  onCreateNewMap: () => void
  groups: Group[]
  mapData: ResultsMapData
}>()

const mapConfig = ref(props.mapData.mapConfig)
const legends = ref(props.mapData.legends)

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
const tour = inject<TourGuideClient>('tourGuide')

const startATour = () => {
  // Configure the tour
  if (tour) {
    const steps = [
      {
        title: 'File Tab',
        content: 'This is the File tab where you can create, import, and export maps.',
        target: '#fileTab',
      },
      {
        title: 'Map Tab',
        content:
          'This is the Map tab where you can configure the map title, date, and layer colors.',
        target: '#mapTab',
      },
      {
        title: 'Legend Tab',
        content: 'This is the Legend tab where you can manage the legend for bubbles and lines.',
        target: '#legendTab',
      },
    ]

    tour.setOptions({ steps })

    tour.onBeforeStepChange(() => {
      console.log(`Before Changing to step: ${tour.activeStep}`)
      switch (tour.activeStep) {
        case 0:
          currentTab.value = 'Map'
          break
        case 1:
          currentTab.value = 'Legend'
          break
        case 2:
          currentTab.value = 'File'
          break
      }
    })

    tour.onFinish(() => {
      console.log('Tour finished')

      currentTab.value = 'File'
    })

    setTimeout(() => {
      //tour.start()
    }, 1000)
  }
}

onMounted(() => {
  //startATour();
})

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
    //visible: true
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
                  <el-input-number
                    v-model="mapConfig.titleFontSize"
                    :min="10"
                    :max="50"
                    style="width: 220px"
                    label="Font Size"
                  ></el-input-number>
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
