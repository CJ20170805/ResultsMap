<script setup lang="ts">
import { ref } from 'vue'
import type { LayerType, RelationType, Bubble, Relationship, Group, ResultsMapData } from '@/types/ResultsMap'
import { mapActions } from 'pinia';

const props = defineProps<{
    onAddBubble: (bubble: Omit<Bubble, 'id'>) => void
    onAddRelationship: (relationship: Omit<Relationship, 'id'>) => void
    onAddGroup: (group: Omit<Group, 'id'>) => void
    onChangeGroupLevel: (groupLevel: LayerType) => void
    groups: Group[],
    mapData: ResultsMapData,
}>()

const newBubble = ref({
    text: '',
    layer: 'process' as LayerType,
    groupId: ''
})

const groupLevel = ref(props.mapData.groupLevel)

const newGroup = ref({
    name: '',
    layers: [] as LayerType[]
})

const newRelationship = ref({
    source: '',
    target: '',
    type: 'cause-effect' as RelationType
})

const layerOptions: LayerType[] = ['mission', 'strategic', 'process', 'operational']
const relationTypes: RelationType[] = ['cause-effect', 'companion', 'conflict']

const handleAddBubble = () => {
    if (newBubble.value.text.trim()) {
        props.onAddBubble({
            text: newBubble.value.text,
            layer: newBubble.value.layer,
            groupId: newBubble.value.groupId
        })
        newBubble.value.text = ''
    }
}

const handleAddGroup = () => {
    if (newGroup.value.name && newGroup.value.layers.length > 0) {
        props.onAddGroup({
            name: newGroup.value.name,
            layers: newGroup.value.layers
        })
        newGroup.value.name = ''
        newGroup.value.layers = []
    }
}

const handleAddRelationship = () => {
    if (newRelationship.value.source && newRelationship.value.target) {
        props.onAddRelationship({
            source: newRelationship.value.source,
            target: newRelationship.value.target,
            type: newRelationship.value.type
        })
        newRelationship.value.source = ''
        newRelationship.value.target = ''
    }
}

const handleGroupLayerChange = () => {
  console.log('EEEEE', groupLevel.value);
  props.onChangeGroupLevel(groupLevel.value);
}
</script>

<template>
    <div class="controls-panel">
        <div class="control-section">
            <h3>Add New Group</h3>
            <div class="form-group">
                <input v-model="newGroup.name" placeholder="Group name" />
                <button @click="handleAddGroup">Add Group</button>
                <span>Group Level: </span>
                <select @change="handleGroupLayerChange" v-model="groupLevel">
                    <option v-for="layer in layerOptions" :key="layer" :value="layer">
                        {{ layer }}
                    </option>
                </select>
            </div>
        </div>

        <div class="control-section">
            <h3>Add New Bubble</h3>
            <div class="form-group">
                <input v-model="newBubble.text" placeholder="Bubble text" />
                <select v-model="newBubble.layer">
                    <option v-for="layer in layerOptions" :key="layer" :value="layer">
                        {{ layer }}
                    </option>
                </select>
                <select v-model="newBubble.groupId" v-if="props.groups.length">
                    <option value="">No Group</option>
                    <option v-for="group in props.groups" :key="group.id" :value="group.id">
                        {{ group.name }}
                    </option>
                </select>
                <button @click="handleAddBubble">Add Bubble</button>
            </div>
        </div>

        <div class="control-section">
            <h3>Add New Relationship</h3>
            <div class="form-group">
                <!-- <input v-model="newRelationship.source" placeholder="Source bubble ID" /> -->
                 <span>From: </span>
                <select v-model="newRelationship.source">
                    <option v-for="bubble in mapData.bubbles" :key="bubble.id" :value="bubble.id">
                        {{ bubble.text }}
                    </option>
                </select>
                <!-- <input v-model="newRelationship.target" placeholder="Target bubble ID" /> -->
                <span>To: </span>
                <select v-model="newRelationship.target">
                    <option v-for="bubble in mapData.bubbles" :key="bubble.id" :value="bubble.id">
                        {{ bubble.text }}
                    </option>
                </select>
                <select v-model="newRelationship.type">
                    <option v-for="type in relationTypes" :key="type" :value="type">
                        {{ type }}
                    </option>
                </select>
                <button @click="handleAddRelationship">Add Relationship</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.controls-panel {
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 4px;
    margin-bottom: 1rem;
}

.control-section {
    margin-bottom: 1rem;
}

.form-group {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
}
span{
 display: inline-block;
 line-height: 40px;
}

input,
select {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
}

button {
    padding: 0.5rem 1rem;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

button:hover {
    background: #45a049;
}

select[multiple] {
    height: 100px;
}
</style>
