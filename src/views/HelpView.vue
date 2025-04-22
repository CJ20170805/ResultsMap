<template>
  <div class="help-page">
    <h1>Help Center</h1>

    <div class="help-container">
      <!-- Search Bar -->
      <el-input
        v-model="searchQuery"
        placeholder="Search for a question..."
        clearable
        @input="filterQuestions"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <!-- Collapse Components for Each Category -->
      <div v-for="(category, index) in filteredCategories" :key="index" class="category">
        <h2>{{ category.title }}</h2>
        <el-collapse v-model="activeCollapseItems" accordion>
          <el-collapse-item
            v-for="(question, qIndex) in category.questions"
            :key="qIndex"
            :title="question.title"
            :name="`${index}-${qIndex}`"
          >
            <div v-html="question.answer"></div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';

// Import GIF images
import createGroupGif from '@/assets/gif/create-group.gif';
import createBubbleGif from '@/assets/gif/create-bubble.gif';
import createRelationshipGif from '@/assets/gif/create-relationship.gif';
import moveMapGif from '@/assets/gif/move-map.gif'
import adjustLineGif from '@/assets/gif/adjust-line.gif'


onMounted(() => {
  document.title = 'Results Map - Help Center';
});

// Define the structure of a question
interface Question {
  title: string;
  answer: string;
}

// Define the structure of a category
interface Category {
  title: string;
  questions: Question[];
}

// Sample list of categories and questions
const categories = ref<Category[]>([
  {
    title: 'Section',
    questions: [
      {
        title: 'How do I create a new section?',
        answer: `
          To create a new section, right-click on the map, type section name(optional) and select "Create Section" from the context menu.
          <br><br>
          <img src="${createGroupGif}" alt="Create Section GIF" style="max-width: 100%; border-radius: 8px;" />
        `,
      },
      {
        title: 'How do I delete a section?',
        answer:
          'To delete a section, right-click on the section area and select "Delete Current Section" from the context menu.',
      },
      {
        title: 'How do I rename a section?',
        answer:
          'To rename a section, right-click on the section area and rename it in the  "Rename" section from the context menu.',
      },
    ],
  },
  {
    title: 'Bubble',
    questions: [
      {
        title: 'How do I create a new bubble?',
        answer: `
          To create a new bubble, right-click on the map and select "Create Bubble" from the context menu.
          <br><br>
          <img src="${createBubbleGif}" alt="Create Bubble GIF" style="max-width: 100%; border-radius: 8px;" />
        `,
      },
      {
        title: 'How do I delete a bubble?',
        answer:
          'To delete a bubble, right-click on the bubble and select "Remove current bubble" from the context menu.',
      },
      {
        title: 'How do I move a bubble?',
        answer: 'To move a bubble, click and drag the bubble to the desired location.',
      },
      {
        title: 'How do I adjust bubble size or text formatting?',
        answer: `
          To adjust the bubble size:
          <ol>
            <li>Hover over the bubble.</li>
            <li>Drag the blue square to resize it.</li>
          </ol>
          To adjust text formatting:
          <ol>
            <li>Right-click on the bubble to open the context menu.</li>
            <li>Change the text, font size, boldness, or color as needed.</li>
          </ol>
        `,
      },
    ],
  },
  {
    title: 'Relationship',
    questions: [
      {
        title: 'How do I create a relationship between bubbles?',
        answer: `
          To create a relationship, right-click on a bubble and select "Create Relationship". Then, click on another bubble to establish the connection.
          <br><br>
          <img src="${createRelationshipGif}" alt="Create Relationship GIF" style="max-width: 100%; border-radius: 8px;" />
        `,
      },
      {
        title: 'How do I delete a relationship?',
        answer:
          'To delete a relationship, right-click on the relationship line and select "Delete Relationship" from the context menu.',
      },
      {
        title: 'How do I change the type of a relationship?',
        answer:
          'To change the type of a relationship, right-click on the relationship line and select "Change Type" from the context menu.',
      },
      {
        title: 'How do I adjust the relationship line?',
        answer: `
          To adjust the relationship line:
          <ol>
            <li>Hover your mouse over the relationship line.</li>
            <li>Blue control points will appear.</li>
            <li>Drag the control points to adjust the line as needed.</li>
          </ol>
          <br><br>
          <img src="${adjustLineGif}" alt="Adjust Relationship Line GIF" style="max-width: 100%; border-radius: 8px;" />
        `,
      },
    ],
  },
  {
    title: 'Presentation Mode',
    questions: [
      {
        title: 'How do I enter presentation mode?',
        answer: 'To enter presentation mode, click the "Presentation Mode" button in the controls.',
      },
      {
        title: 'How do I exit presentation mode?',
        answer:
          'To exit presentation mode, click the "Presentation Mode" button again in the controls.',
      },
      {
        title: 'How do I navigate layers in presentation mode?',
        answer: 'To navigate layers, move your mouse to the bottom, then the control bar will show up. Use the layer navigation buttons to switch between layers in presentation mode.',
      },
      {
        title: 'How do I navigate sections in presentation mode?',
        answer: 'To navigate layers, move your mouse to the bottom, then the control bar will show up. Use the selection box to switch section in presentation mode.',
      },
      {
        title: 'How do I emphasize the bubble with its related bubbles in presentation mode?',
        answer: 'To emphasize bubble relationships, click on any bubble, then the currrent bubble with its related relationships and bubbles will be highlight.',
      },
      {
        title: 'How do I reset control options in presentation mode?',
        answer: 'To reset control options, move your mouse to the bottom, then click the reset button',
      },
    ],
  },
  {
    title: 'Map',
    questions: [
      {
        title: 'How do I move elements on the map?',
        answer: `
          To move elements on the map, including the map, title, group title, bubbles, dividers, and the entire map:
          <ol>
            <li>Left-click on the map, title, group title, bubble, or divider.</li>
            <li>Drag it to the desired position.</li>
          </ol>
          <br>
          <img style="width: 100%;" src="${moveMapGif}" alt="Move elements on the map tutorial GIF" />
        `,
      },
      {
        title: 'How do I export the map?',
        answer:
          'To export the map, click the "Export" button and choose the desired format (PNG, PDF, or Source Data).',
      },
    ],
  },
]);

// Search query for filtering questions
const searchQuery = ref<string>('');

// Active collapse items (for accordion behavior)
const activeCollapseItems = ref<string[]>([]);

// Filtered categories based on search query
const filteredCategories = computed(() => {
  if (!searchQuery.value) {
    return categories.value; // Return all categories if no search query
  }
  const query = searchQuery.value.toLowerCase();
  return categories.value
    .map((category) => ({
      ...category,
      questions: category.questions.filter(
        (question) =>
          question.title.toLowerCase().includes(query) ||
          question.answer.toLowerCase().includes(query)
      ),
    }))
    .filter((category) => category.questions.length > 0); // Only show categories with matching questions
});

// Function to filter questions (optional, can be removed if using computed directly)
const filterQuestions = () => {
  // The computed property `filteredCategories` will automatically update
};
</script>

<style scoped>
.help-page {
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
}

.help-container {
  width: 960px;
  margin: 0 auto;
}

h1 {
  text-align: center;
  margin-bottom: 20px;
}

h2 {
  margin-top: 20px;
  margin-bottom: 10px;
  color: #409eff;
}

.el-input {
  margin-bottom: 20px;
}

.category {
  margin-bottom: 30px;
}

.el-collapse-item {
  margin-bottom: 10px;
}
</style>
