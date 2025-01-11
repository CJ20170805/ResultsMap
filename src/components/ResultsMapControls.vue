<script setup lang="ts">
import { ref } from 'vue'
import type { LayerType, RelationType, Bubble, Relationship } from '@/types/ResultsMap'

const props = defineProps<{
    onAddBubble: (bubble: Omit<Bubble, 'id'>) => void
    onAddRelationship: (relationship: Omit<Relationship, 'id'>) => void
}>()

const newBubble = ref({
    text: '',
    layer: 'process' as LayerType
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
            layer: newBubble.value.layer
        })
        newBubble.value.text = ''
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
</script>

<template>
    <div class="controls-panel">
        <div class="control-section">
            <h3>Add New Bubble</h3>
            <div class="form-group">
                <input v-model="newBubble.text" placeholder="Bubble text" />
                <select v-model="newBubble.layer">
                    <option v-for="layer in layerOptions" :key="layer" :value="layer">
                        {{ layer }}
                    </option>
                </select>
                <button @click="handleAddBubble">Add Bubble</button>
            </div>
        </div>

        <div class="control-section">
            <h3>Add New Relationship</h3>
            <div class="form-group">
                <input v-model="newRelationship.source" placeholder="Source bubble ID" />
                <input v-model="newRelationship.target" placeholder="Target bubble ID" />
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
</style>