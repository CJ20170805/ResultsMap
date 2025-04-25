// src/plugins/tourGuide.ts
import type { App } from 'vue'
import '@sjmc11/tourguidejs/src/scss/tour.scss' // Styles
import { TourGuideClient } from '@sjmc11/tourguidejs/src/Tour' // JS

let tour: TourGuideClient | null = null

export default {
  install(app: App) {
    if (!tour) {
      tour = new TourGuideClient({
        steps: [],
        hidePrev: false,
        backdropClass: "custom-backdrop-class",
        dialogZ: 3000,
      })
    }
    app.provide('tourGuide', tour)
  },
}
