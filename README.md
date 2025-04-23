# ResultsMap

ResultsMap is a visualization tool designed to help users create, manage, and present hierarchical data in a structured and interactive way. It allows users to define layers, sections, bubbles, and relationships, making it ideal for mapping processes, strategies, and outcomes.

## Features

- **Interactive Map Creation**: Create sections, bubbles, and relationships dynamically.
- **Layered Visualization**: Organize data into hierarchical layers (Mission, Strategic, Process, Operational).
- **Customizable Elements**: Adjust text, colors, font sizes, and weights for sections and bubbles.
- **Presentation Mode**: Highlight specific layers, sections, or relationships for presentations.
- **Export Options**: Export the map as PNG, PDF, or JSON.
- **Help Center**: Access a built-in help center for guidance.
- **Tour Guide**: Step-by-step onboarding for new users.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize Configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Usage

### Creating Sections and Bubbles
- **Sections**: Right-click on the map to create a new section. Enter the section name and click "Create Section."
- **Bubbles**: Right-click on the map to create a new bubble. Enter the bubble text and click "Create Bubble."

### Managing Relationships
- Right-click on a bubble to create a relationship. Select the relationship type and click "Create Relationship." Then, click on the target bubble to complete the relationship.

### Presentation Mode
- Click the "Presentation Mode" button to enter a simplified view for presentations. Use the controls to navigate layers and sections.

### Exporting Maps
- Use the export buttons to save the map as PNG, PDF, or JSON.

### Help Center
- Access the Help Center by clicking the "Help" button in the toolbar.

## File Structure

- **`src/components`**: Contains Vue components for the UI.
- **`src/views`**: Contains the main views of the application.
- **`src/data`**: Stores default and sample data files.
- **`src/plugins`**: Includes plugins like the Tour Guide.
- **`src/assets`**: Contains styles, images, and other static assets.
- **`src/types`**: Defines TypeScript types for the project.

## Key Components

### `ResultsMap.vue`
The core component responsible for rendering the map, handling interactions, and managing data.

### `ResultsMapControls.vue`
Provides controls for managing map elements, exporting data, and navigating the application.

### `HelpView.vue`
Displays the Help Center with categorized FAQs and search functionality.

## Customization

- **Layer Colors**: Modify the `layerColors` in `src/data/default.ts` to change the default colors for layers.
- **Legends**: Update the `legends` property in the data files to customize legend bubbles and lines.


## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgments

- [Vue.js](https://vuejs.org/)
- [D3.js](https://d3js.org/)
- [Element Plus](https://element-plus.org/)
