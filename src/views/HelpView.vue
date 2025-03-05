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
    title: 'Group',
    questions: [
      {
        title: 'How do I create a new group?',
        answer: `
          To create a new group, right-click on the map and select "Create Group" from the context menu.
          <br><br>
          <img src="${createGroupGif}" alt="Create Group GIF" style="max-width: 100%; border-radius: 8px;" />
        `,
      },
      {
        title: 'How do I delete a group?',
        answer:
          'To delete a group, right-click on the group name and select "Delete Group" from the context menu.',
      },
      {
        title: 'How do I rename a group?',
        answer:
          'To rename a group, right-click on the group name and select "Rename Group" from the context menu.',
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
          'To delete a bubble, right-click on the bubble and select "Remove" from the context menu.',
      },
      {
        title: 'How do I move a bubble?',
        answer: 'To move a bubble, click and drag the bubble to the desired location.',
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
          'To exit presentation mode, click the "Exit Presentation Mode" button in the controls.',
      },
      {
        title: 'How do I navigate layers in presentation mode?',
        answer: 'Use the layer navigation buttons to switch between layers in presentation mode.',
      },
    ],
  },
  {
    title: 'Other Settings',
    questions: [
      {
        title: 'How do I reset the map?',
        answer: 'To reset the map, click the "Reset" button in the presentation controls.',
      },
      {
        title: 'How do I export the map?',
        answer:
          'To export the map, click the "Export" button and choose the desired format (PNG, PDF, or JSON).',
      },
      {
        title: 'How do I change the map title?',
        answer:
          'To change the map title, click the "Settings" button and update the title in the settings menu.',
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
