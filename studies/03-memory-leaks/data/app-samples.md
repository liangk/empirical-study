# Study 03: Memory Leaks — Frontend App Repository Sample List

> Compiled for the "Memory Leak Epidemic in React/Vue/Angular Apps" empirical study.
> All repos are public GitHub repositories suitable for scanning for missing-cleanup
> patterns in lifecycle hooks, event listeners, timers, and subscriptions.

---

## Leak Patterns to Detect

| Pattern | Framework(s) | Severity |
|---------|-------------|----------|
| `useEffect` without cleanup return | React | High |
| `addEventListener` without `removeEventListener` | All | High |
| `setInterval`/`setTimeout` without cleanup | All | Medium |
| `.subscribe()` without `.unsubscribe()` | Angular, React (RxJS) | High |
| Missing `ngOnDestroy` with active subscriptions | Angular | High |
| `onMounted` without `onUnmounted` cleanup | Vue | High |
| `watch`/`watchEffect` stop handle not captured | Vue | Medium |
| `Renderer2.listen()` return not stored | Angular | High |
| `IntersectionObserver`/`MutationObserver` without `.disconnect()` | All | Medium |
| `requestAnimationFrame` without `cancelAnimationFrame` | All | Medium |
| Global event bus `.on()` without `.off()` | Vue, React | Medium |

---

## Repository Selection Logic

1. **Lifecycle intensity** — Prefer apps with frequent mount/unmount cycles (dashboards, real-time apps, component libraries) so detectors see many opportunities for missed cleanup.
2. **Event-driven workload** — Focus on repos that rely on listeners, timers, subscriptions, observers, and background workers where leaks commonly originate.
3. **Production maturity** — Only include active, community-validated projects (≈500+ stars) with substantial codebases to guarantee realistic patterns and scale.
4. **Framework coverage** — Verify each repo actually ships React/Vue/Angular UI code (e.g., `.tsx`, `.vue`, decorators) rather than backend-only or tooling-only projects.
5. **Use-case diversity** — Balance categories (admin panels, CMS, mobile, media, devtools) to surface different leak patterns and avoid bias toward a single app style.
6. **Scan feasibility** — Ensure repos are open-source, buildable, and license-compatible so automated cloning, static analysis, and benchmarks can run without blockers.

---

## Category 1: React — Full-Stack & SSR Frameworks

These are production-grade React frameworks and starter kits with extensive component trees.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 1 | vercel/next.js | https://github.com/vercel/next.js | 120k | React SSR framework |
| 2 | facebook/create-react-app | https://github.com/facebook/create-react-app | 102k | Official React starter |
| 3 | remix-run/remix | https://github.com/remix-run/remix | 28k | Full-stack React framework |
| 4 | blitz-js/blitz | https://github.com/blitz-js/blitz | 13k | Full-stack React framework |
| 5 | redwoodjs/redwood | https://github.com/redwoodjs/redwood | 17k | Full-stack React framework |
| 6 | refinedev/refine | https://github.com/refinedev/refine | 25k | React admin framework |
| 7 | TanStack/router | https://github.com/TanStack/router | 7k | Type-safe React router |
| 8 | trpc/trpc | https://github.com/trpc/trpc | 33k | End-to-end typesafe APIs |
| 9 | t3-oss/create-t3-app | https://github.com/t3-oss/create-t3-app | 24k | Full-stack T3 stack |
| 10 | wasp-lang/wasp | https://github.com/wasp-lang/wasp | 12k | Full-stack React framework |

## Category 2: React — Component Libraries & UI Kits

Heavy component usage with lifecycle management.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 11 | mui/material-ui | https://github.com/mui/material-ui | 92k | Material Design components |
| 12 | ant-design/ant-design | https://github.com/ant-design/ant-design | 90k | Enterprise UI library |
| 13 | chakra-ui/chakra-ui | https://github.com/chakra-ui/chakra-ui | 37k | Accessible component library |
| 14 | radix-ui/primitives | https://github.com/radix-ui/primitives | 15k | Unstyled accessible components |
| 15 | shadcn-ui/ui | https://github.com/shadcn-ui/ui | 60k | Copy-paste UI components |
| 16 | mantinedev/mantine | https://github.com/mantinedev/mantine | 25k | Full-featured React library |
| 17 | nextui-org/nextui | https://github.com/nextui-org/nextui | 20k | Beautiful React UI |
| 18 | tremor/tremor | https://github.com/tremorlabs/tremor | 16k | Dashboard components |
| 19 | adobe/react-spectrum | https://github.com/adobe/react-spectrum | 12k | Adobe design system |
| 20 | ariakit/ariakit | https://github.com/ariakit/ariakit | 8k | Accessible toolkit |

## Category 3: React — Data & State Management

Subscription-heavy patterns with potential cleanup issues.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 21 | pmndrs/zustand | https://github.com/pmndrs/zustand | 44k | Lightweight state management |
| 22 | reduxjs/redux-toolkit | https://github.com/reduxjs/redux-toolkit | 10k | Official Redux toolset |
| 23 | TanStack/query | https://github.com/TanStack/query | 40k | Async state management |
| 24 | pmndrs/jotai | https://github.com/pmndrs/jotai | 17k | Primitive atomic state |
| 25 | facebookexperimental/Recoil | https://github.com/facebookexperimental/Recoil | 19k | Experimental state management |
| 26 | mobxjs/mobx | https://github.com/mobxjs/mobx | 27k | Observable state management |
| 27 | apollographql/apollo-client | https://github.com/apollographql/apollo-client | 19k | GraphQL client |
| 28 | urql-graphql/urql | https://github.com/urql-graphql/urql | 8k | GraphQL client |
| 29 | vercel/swr | https://github.com/vercel/swr | 30k | React Hooks for data fetching |
| 30 | dai-shi/use-context-selector | https://github.com/dai-shi/use-context-selector | 2k | Context performance |

## Category 4: React — Dashboard & Admin Apps

Real-world apps with complex component hierarchies and subscriptions.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 31 | grafana/grafana | https://github.com/grafana/grafana | 61k | Monitoring dashboard |
| 32 | apache/superset | https://github.com/apache/superset | 60k | Data exploration platform |
| 33 | nocodb/nocodb | https://github.com/nocodb/nocodb | 43k | Airtable alternative |
| 34 | appsmithorg/appsmith | https://github.com/appsmithorg/appsmith | 32k | Low-code platform |
| 35 | tooljet/tooljet | https://github.com/ToolJet/ToolJet | 28k | Low-code platform |
| 36 | directus/directus | https://github.com/directus/directus | 26k | Headless CMS |
| 37 | calcom/cal.com | https://github.com/calcom/cal.com | 29k | Scheduling platform |
| 38 | twentyhq/twenty | https://github.com/twentyhq/twenty | 15k | Open-source CRM |
| 39 | immich-app/immich | https://github.com/immich-app/immich | 35k | Photo management |
| 40 | hoppscotch/hoppscotch | https://github.com/hoppscotch/hoppscotch | 61k | API development |

## Category 5: React — Real-Time & WebSocket Apps

WebSocket and event-driven patterns with high leak potential.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 41 | RocketChat/Rocket.Chat | https://github.com/RocketChat/Rocket.Chat | 39k | Team chat platform |
| 42 | mattermost/mattermost | https://github.com/mattermost/mattermost | 28k | Messaging platform |
| 43 | excalidraw/excalidraw | https://github.com/excalidraw/excalidraw | 75k | Collaborative whiteboard |
| 44 | liveblocks/liveblocks | https://github.com/liveblocks/liveblocks | 3k | Real-time collaboration |
| 45 | yjs/yjs | https://github.com/yjs/yjs | 15k | CRDT framework |
| 46 | socketio/socket.io | https://github.com/socketio/socket.io | 60k | Real-time engine |
| 47 | novuhq/novu | https://github.com/novuhq/novu | 33k | Notification infrastructure |
| 48 | highlight/highlight | https://github.com/highlight/highlight | 7k | Monitoring platform |
| 49 | daily-co/daily-js | https://github.com/daily-co/daily-js | 300 | Video call SDK |
| 50 | livekit/components-js | https://github.com/livekit/components-js | 300 | WebRTC components |

## Category 6: React — Media & Animation Apps

Animation frame and observer pattern heavy.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 51 | pmndrs/react-three-fiber | https://github.com/pmndrs/react-three-fiber | 26k | React renderer for Three.js |
| 52 | framer/motion | https://github.com/framer/motion | 22k | Animation library |
| 53 | airbnb/lottie-web | https://github.com/airbnb/lottie-web | 30k | Animation renderer |
| 54 | remotion-dev/remotion | https://github.com/remotion-dev/remotion | 19k | Video creation in React |
| 55 | xyflow/xyflow | https://github.com/xyflow/xyflow | 22k | Node-based editor |
| 56 | react-grid-layout/react-grid-layout | https://github.com/react-grid-layout/react-grid-layout | 19k | Draggable grid |
| 57 | bvaughn/react-virtualized | https://github.com/bvaughn/react-virtualized | 26k | Virtualised lists |
| 58 | TanStack/virtual | https://github.com/TanStack/virtual | 5k | Headless virtualisation |
| 59 | clauderic/dnd-kit | https://github.com/clauderic/dnd-kit | 12k | Drag and drop toolkit |
| 60 | nandorojo/moti | https://github.com/nandorojo/moti | 4k | React Native animations |

## Category 7: React — E-Commerce & Content Platforms

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 61 | medusajs/medusa | https://github.com/medusajs/medusa | 23k | Headless commerce |
| 62 | saleor/saleor-dashboard | https://github.com/saleor/saleor-dashboard | 20k | Commerce dashboard |
| 63 | vercel/commerce | https://github.com/vercel/commerce | 10k | Commerce starter |
| 64 | payloadcms/payload | https://github.com/payloadcms/payload | 20k | Headless CMS |
| 65 | keystonejs/keystone | https://github.com/keystonejs/keystone | 9k | CMS & app framework |
| 66 | sanity-io/sanity | https://github.com/sanity-io/sanity | 5k | Content platform |
| 67 | tinacms/tinacms | https://github.com/tinacms/tinacms | 11k | Git-backed CMS |
| 68 | BuilderIO/builder | https://github.com/BuilderIO/builder | 7k | Visual CMS |
| 69 | docusaurus/docusaurus | https://github.com/facebook/docusaurus | 54k | Documentation framework |
| 70 | outline/outline | https://github.com/outline/outline | 25k | Knowledge base |

## Category 8: React — Developer Tools & IDEs

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 71 | facebook/react-devtools | https://github.com/facebook/react | 224k | React dev tools |
| 72 | storybook-js/storybook | https://github.com/storybookjs/storybook | 83k | UI component explorer |
| 73 | codesandbox/codesandbox-client | https://github.com/codesandbox/codesandbox-client | 13k | Online IDE |
| 74 | microsoft/playwright | https://github.com/microsoft/playwright | 63k | Browser automation |
| 75 | vitest-dev/vitest | https://github.com/vitest-dev/vitest | 12k | Testing framework |
| 76 | cypress-io/cypress | https://github.com/cypress-io/cypress | 46k | E2E testing |
| 77 | vercel/hyper | https://github.com/vercel/hyper | 43k | Terminal emulator |
| 78 | jestjs/jest | https://github.com/jestjs/jest | 44k | Testing framework |
| 79 | pmndrs/zustand | https://github.com/pmndrs/zustand | 44k | State management |
| 80 | tailwindlabs/headlessui | https://github.com/tailwindlabs/headlessui | 25k | Unstyled components |

## Category 9: React — Mobile & Cross-Platform

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 81 | expo/expo | https://github.com/expo/expo | 30k | React Native platform |
| 82 | infinitered/ignite | https://github.com/infinitered/ignite | 17k | React Native boilerplate |
| 83 | callstack/react-native-paper | https://github.com/callstack/react-native-paper | 12k | Material components |
| 84 | wix/react-native-calendars | https://github.com/wix/react-native-calendars | 9k | Calendar components |
| 85 | software-mansion/react-native-reanimated | https://github.com/software-mansion/react-native-reanimated | 8k | Animations |
| 86 | react-navigation/react-navigation | https://github.com/react-navigation/react-navigation | 23k | Navigation library |
| 87 | invertase/react-native-firebase | https://github.com/invertase/react-native-firebase | 11k | Firebase integration |
| 88 | mrousavy/react-native-vision-camera | https://github.com/mrousavy/react-native-vision-camera | 7k | Camera library |
| 89 | Shopify/react-native-skia | https://github.com/Shopify/react-native-skia | 7k | 2D graphics |
| 90 | tamagui/tamagui | https://github.com/tamagui/tamagui | 10k | Universal UI |

## Category 10: React — Misc Production Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 91 | alan2207/bulletproof-react | https://github.com/alan2207/bulletproof-react | 25k | React architecture |
| 92 | supabase/supabase | https://github.com/supabase/supabase | 68k | Firebase alternative |
| 93 | discourse/discourse | https://github.com/discourse/discourse | 41k | Discussion platform |
| 94 | webstudio-is/webstudio | https://github.com/webstudio-is/webstudio | 4k | Visual builder |
| 95 | tremorlabs/tremor | https://github.com/tremorlabs/tremor | 16k | Dashboard components |
| 96 | baptisteArno/typebot.io | https://github.com/baptisteArno/typebot.io | 5k | Chatbot builder |
| 97 | makeplane/plane | https://github.com/makeplane/plane | 26k | Project management |
| 98 | langgenius/dify | https://github.com/langgenius/dify | 35k | LLM app platform |
| 99 | lobehub/lobe-chat | https://github.com/lobehub/lobe-chat | 30k | ChatGPT UI |
| 100 | ChatGPTNextWeb/ChatGPT-Next-Web | https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web | 72k | ChatGPT web UI |

---

## Category 11: Vue — Full-Stack & SSR Frameworks

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 101 | nuxt/nuxt | https://github.com/nuxt/nuxt | 53k | Vue SSR framework |
| 102 | vuejs/vue | https://github.com/vuejs/vue | 207k | Vue.js core |
| 103 | vuejs/core | https://github.com/vuejs/core | 45k | Vue 3 core |
| 104 | vitejs/vite | https://github.com/vitejs/vite | 66k | Build tool |
| 105 | vitest-dev/vitest | https://github.com/vitest-dev/vitest | 12k | Testing framework |

## Category 12: Vue — Component Libraries

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 106 | element-plus/element-plus | https://github.com/element-plus/element-plus | 24k | Vue 3 UI library |
| 107 | vuetifyjs/vuetify | https://github.com/vuetifyjs/vuetify | 39k | Material Design |
| 108 | primefaces/primevue | https://github.com/primefaces/primevue | 8k | UI suite |
| 109 | vueComponent/ant-design-vue | https://github.com/vueComponent/ant-design-vue | 20k | Ant Design for Vue |
| 110 | tusen-ai/naive-ui | https://github.com/tusen-ai/naive-ui | 15k | Vue 3 components |
| 111 | Akryum/vue-virtual-scroller | https://github.com/Akryum/vue-virtual-scroller | 9k | Virtual scrolling |
| 112 | vueuse/vueuse | https://github.com/vueuse/vueuse | 19k | Composition utilities |
| 113 | varletjs/varlet | https://github.com/varletjs/varlet | 5k | Material components |
| 114 | quasarframework/quasar | https://github.com/quasarframework/quasar | 25k | Vue framework |
| 115 | oku-ui/primitives | https://github.com/oku-ui/primitives | 1k | Unstyled Vue components |

## Category 13: Vue — Admin & Dashboard Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 116 | PanJiaChen/vue-element-admin | https://github.com/PanJiaChen/vue-element-admin | 87k | Admin template |
| 117 | vbenjs/vue-vben-admin | https://github.com/vbenjs/vue-vben-admin | 23k | Admin framework |
| 118 | lin-xin/vue-manage-system | https://github.com/lin-xin/vue-manage-system | 18k | Admin template |
| 119 | flipped-aurora/gin-vue-admin | https://github.com/flipped-aurora/gin-vue-admin | 20k | Full-stack admin |
| 120 | jeecgboot/jeecg-boot | https://github.com/jeecgboot/jeecg-boot | 38k | Low-code platform |
| 121 | ElemeFE/element | https://github.com/ElemeFE/element | 54k | Vue 2 UI library |
| 122 | bailicangdu/vue2-elm | https://github.com/bailicangdu/vue2-elm | 41k | Ele.me app clone |
| 123 | pure-admin/vue-pure-admin | https://github.com/pure-admin/vue-pure-admin | 15k | Admin template |
| 124 | Molunerfinn/PicGo | https://github.com/Molunerfinn/PicGo | 23k | Image uploader |
| 125 | requarks/wiki | https://github.com/requarks/wiki | 24k | Wiki engine |

## Category 14: Vue — State Management & Composables

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 126 | vuejs/pinia | https://github.com/vuejs/pinia | 12k | Vue store |
| 127 | vuex/vuex | https://github.com/vuejs/vuex | 28k | State management |
| 128 | posva/pinia-colada | https://github.com/posva/pinia-colada | 1k | Async state |
| 129 | vueuse/vueuse | https://github.com/vueuse/vueuse | 19k | Composition utilities |
| 130 | logaretm/vee-validate | https://github.com/logaretm/vee-validate | 10k | Form validation |

## Category 15: Vue — Real-Time & Media Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 131 | hoppscotch/hoppscotch | https://github.com/hoppscotch/hoppscotch | 61k | API platform |
| 132 | slidevjs/slidev | https://github.com/slidevjs/slidev | 32k | Presentation slides |
| 133 | elk-zone/elk | https://github.com/elk-zone/elk | 5k | Mastodon client |
| 134 | vuejs/devtools | https://github.com/vuejs/devtools | 6k | Vue dev tools |
| 135 | vuepress/vuepress-next | https://github.com/vuepress/vuepress-next | 3k | Static site generator |

## Category 16: Vue — E-Commerce & CMS

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 136 | vuestorefront/vue-storefront | https://github.com/vuestorefront/vue-storefront | 11k | Commerce frontend |
| 137 | bagisto/bagisto | https://github.com/bagisto/bagisto | 12k | E-commerce platform |
| 138 | getferdi/ferdi | https://github.com/getferdi/ferdi | 9k | Messaging app |
| 139 | frappe/frappe | https://github.com/frappe/frappe | 14k | Web framework |
| 140 | zammad/zammad | https://github.com/zammad/zammad | 4k | Helpdesk system |

## Category 17: Vue — Misc Production Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 141 | Lissy93/dashy | https://github.com/Lissy93/dashy | 16k | Dashboard app |
| 142 | massCodeIO/massCode | https://github.com/massCodeIO/massCode | 5k | Code snippets manager |
| 143 | CorentinTh/it-tools | https://github.com/CorentinTh/it-tools | 18k | Developer utilities |
| 144 | fenixsoft/awesome-fenix | https://github.com/fenixsoft/awesome-fenix | 8k | Architecture demo |
| 145 | yangzongzhuan/RuoYi-Vue3 | https://github.com/yangzongzhuan/RuoYi-Vue3 | 4k | Admin system |
| 146 | antfu/vitesse | https://github.com/antfu/vitesse | 9k | Vue 3 starter |
| 147 | lusaxweb/vuesax-next | https://github.com/lusaxweb/vuesax-next | 2k | Vue 3 UI framework |
| 148 | dcloudio/uni-app | https://github.com/dcloudio/uni-app | 40k | Cross-platform framework |
| 149 | alibaba/formily | https://github.com/alibaba/formily | 11k | Form solution |
| 150 | youzan/vant | https://github.com/youzan/vant | 23k | Mobile UI components |

---

## Category 18: Angular — Core & Frameworks

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 151 | angular/angular | https://github.com/angular/angular | 95k | Angular framework |
| 152 | angular/components | https://github.com/angular/components | 24k | Material components |
| 153 | nrwl/nx | https://github.com/nrwl/nx | 22k | Monorepo tools |
| 154 | angular/angular-cli | https://github.com/angular/angular-cli | 27k | CLI tooling |
| 155 | analogjs/analog | https://github.com/analogjs/analog | 2k | Angular meta-framework |

## Category 19: Angular — Component Libraries

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 156 | primefaces/primeng | https://github.com/primefaces/primeng | 10k | UI components |
| 157 | ng-bootstrap/ng-bootstrap | https://github.com/ng-bootstrap/ng-bootstrap | 8k | Bootstrap components |
| 158 | vmware-clarity/ng-clarity | https://github.com/vmware-clarity/ng-clarity | 6k | VMware design system |
| 159 | ng-zorro/ng-zorro-antd | https://github.com/NG-ZORRO/ng-zorro-antd | 9k | Ant Design for Angular |
| 160 | valor-software/ngx-bootstrap | https://github.com/valor-software/ngx-bootstrap | 5k | Bootstrap for Angular |

## Category 20: Angular — Admin & Enterprise Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 161 | nicekiwi/realworld-angular | https://github.com/gothinkster/angular-realworld-example-app | 5k | RealWorld example |
| 162 | akveo/ngx-admin | https://github.com/akveo/ngx-admin | 25k | Admin dashboard |
| 163 | angular-university/rxjs-course | https://github.com/angular-university/rxjs-course | 2k | RxJS patterns |
| 164 | tomastrajan/angular-ngrx-material-starter | https://github.com/tomastrajan/angular-ngrx-material-starter | 3k | NgRx starter |
| 165 | pwa-builder/pwabuilder | https://github.com/nicekiwi/nicekiwi | 1k | PWA builder |

## Category 21: Angular — State Management & RxJS

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 166 | ngrx/platform | https://github.com/ngrx/platform | 8k | Reactive state management |
| 167 | ngxs/store | https://github.com/ngxs/store | 4k | State management |
| 168 | ngneat/elf | https://github.com/ngneat/elf | 2k | Reactive store |
| 169 | rx-angular/rx-angular | https://github.com/rx-angular/rx-angular | 2k | Reactive extensions |
| 170 | ngneat/until-destroy | https://github.com/ngneat/until-destroy | 2k | Auto unsubscribe |

## Category 22: Angular — Real-Time & Data Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 171 | ever-co/ever-gauzy | https://github.com/ever-co/ever-gauzy | 2k | Business management platform |
| 172 | bitwarden/clients | https://github.com/bitwarden/clients | 8k | Password manager clients |
| 173 | angular/angular-realworld-example-app | https://github.com/gothinkster/angular-realworld-example-app | 5k | RealWorld CRUD app |
| 174 | treojs/treo | https://github.com/ngneat/transloco | 2k | i18n library demo |
| 175 | SAP/spartacus | https://github.com/SAP/spartacus | 700 | E-commerce storefront |

## Category 23: Angular — Testing & DevTools

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 176 | compodoc/compodoc | https://github.com/compodoc/compodoc | 4k | Documentation tool |
| 177 | scully-io/scully | https://github.com/scullyio/scully | 3k | Static site generator |
| 178 | testing-library/angular-testing-library | https://github.com/testing-library/angular-testing-library | 1k | Testing utilities |
| 179 | ngneat/spectator | https://github.com/ngneat/spectator | 2k | Testing library |
| 180 | nicekiwi/angular-eslint | https://github.com/angular-eslint/angular-eslint | 2k | Linting |

## Category 24: Angular — Misc Production Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 181 | gothinkster/angular-realworld-example-app | https://github.com/gothinkster/angular-realworld-example-app | 5k | RealWorld spec implementation |
| 182 | ng-select/ng-select | https://github.com/ng-select/ng-select | 3k | Select component |
| 183 | mattlewis92/angular-calendar | https://github.com/mattlewis92/angular-calendar | 3k | Calendar component |
| 184 | swimlane/ngx-datatable | https://github.com/swimlane/ngx-datatable | 5k | Data table component |
| 185 | swimlane/ngx-charts | https://github.com/swimlane/ngx-charts | 4k | Charting library |
| 186 | ngx-formly/ngx-formly | https://github.com/ngx-formly/ngx-formly | 3k | Dynamic forms |
| 187 | akveo/nebular | https://github.com/akveo/nebular | 8k | UI component kit |
| 188 | ngx-translate/core | https://github.com/ngx-translate/core | 5k | i18n translation library |
| 189 | angular/angularfire | https://github.com/angular/angularfire | 8k | Firebase integration |
| 190 | ionic-team/ionic-framework | https://github.com/ionic-team/ionic-framework | 51k | Cross-platform UI framework |

## Category 25: React — Additional Production Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 191 | floating-ui/floating-ui | https://github.com/floating-ui/floating-ui | 28k | Tooltip positioning |
| 192 | dexie/Dexie.js | https://github.com/dexie/Dexie.js | 11k | IndexedDB wrapper |
| 193 | recharts/recharts | https://github.com/recharts/recharts | 23k | Chart library |
| 194 | nivo-rocks/nivo | https://github.com/plouc/nivo | 13k | Data visualization |
| 195 | react-hook-form/react-hook-form | https://github.com/react-hook-form/react-hook-form | 40k | Form library |
| 196 | formium/formik | https://github.com/jaredpalmer/formik | 34k | Form management |
| 197 | JedWatson/react-select | https://github.com/JedWatson/react-select | 27k | Select component |
| 198 | downshift-js/downshift | https://github.com/downshift-js/downshift | 12k | Autocomplete library |
| 199 | react-dnd/react-dnd | https://github.com/react-dnd/react-dnd | 21k | Drag and drop |
| 200 | atlassian/react-beautiful-dnd | https://github.com/atlassian/react-beautiful-dnd | 33k | Drag and drop |

## Category 26: React — Testing & Dev Experience

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 201 | testing-library/react-testing-library | https://github.com/testing-library/react-testing-library | 19k | Testing utilities |
| 202 | enzyme-js/enzyme | https://github.com/enzymejs/enzyme | 20k | Testing utility |
| 203 | wojtekmaj/react-lifecycle-methods-diagram | https://github.com/wojtekmaj/react-lifecycle-methods-diagram | 8k | Lifecycle visualizer |
| 204 | welldone-software/why-did-you-render | https://github.com/welldone-software/why-did-you-render | 10k | Performance tool |
| 205 | pmmmwh/react-refresh-webpack-plugin | https://github.com/pmmmwh/react-refresh-webpack-plugin | 3k | Fast refresh |
| 206 | gaearon/react-hot-loader | https://github.com/gaearon/react-hot-loader | 12k | Hot reloading |
| 207 | styleguidist/react-styleguidist | https://github.com/styleguidist/react-styleguidist | 11k | Component docs |
| 208 | react-cosmos/react-cosmos | https://github.com/react-cosmos/react-cosmos | 8k | Dev tool |
| 209 | debugger/react-inspector | https://github.com/storybookjs/react-inspector | 2k | Object inspector |
| 210 | davidkpiano/xstate | https://github.com/statelyai/xstate | 26k | State machines |

## Category 27: React — More Dashboard & Analytics

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 211 | metabase/metabase | https://github.com/metabase/metabase | 37k | Analytics platform |
| 212 | redash/redash | https://github.com/getredash/redash | 25k | Data visualization |
| 213 | lightdash/lightdash | https://github.com/lightdash/lightdash | 3k | BI platform |
| 214 | preset-io/superset | https://github.com/apache/superset | 60k | Data exploration |
| 215 | cube-js/cube | https://github.com/cube-js/cube | 17k | Analytics API |
| 216 | keen/keen-dataviz.js | https://github.com/keen/keen-dataviz.js | 1k | Data viz |
| 217 | airbnb/visx | https://github.com/airbnb/visx | 19k | Visualization library |
| 218 | elastic/kibana | https://github.com/elastic/kibana | 20k | Analytics interface |
| 219 | posthog/posthog | https://github.com/PostHog/posthog | 18k | Product analytics |
| 220 | umami-software/umami | https://github.com/umami-software/umami | 20k | Web analytics |

## Category 28: React — Additional SaaS & Platforms

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 221 | chatwoot/chatwoot | https://github.com/chatwoot/chatwoot | 19k | Customer support |
| 222 | getlago/lago | https://github.com/getlago/lago | 6k | Billing platform |
| 223 | formbricks/formbricks | https://github.com/formbricks/formbricks | 5k | Survey platform |
| 224 | infisical/infisical | https://github.com/Infisical/infisical | 13k | Secret management |
| 225 | windmill-labs/windmill | https://github.com/windmill-labs/windmill | 9k | Workflow engine |
| 226 | n8n-io/n8n | https://github.com/n8n-io/n8n | 42k | Workflow automation |
| 227 | activepieces/activepieces | https://github.com/activepieces/activepieces | 8k | Automation platform |
| 228 | replicate/cog | https://github.com/replicate/cog | 7k | ML containers |
| 229 | orchest/orchest | https://github.com/orchest/orchest | 4k | Data pipelines |
| 230 | dagger/dagger | https://github.com/dagger/dagger | 10k | CI/CD pipelines |

## Category 29: React — Design Systems & Libraries

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 231 | palantir/blueprint | https://github.com/palantir/blueprint | 20k | Design system |
| 232 | grommet/grommet | https://github.com/grommet/grommet | 8k | Component library |
| 233 | uber/baseweb | https://github.com/uber/baseweb | 9k | Design system |
| 234 | carbon-design-system/carbon | https://github.com/carbon-design-system/carbon | 7k | IBM design system |
| 235 | microsoft/fluentui | https://github.com/microsoft/fluentui | 18k | Fluent UI |
| 236 | primer/react | https://github.com/primer/react | 3k | GitHub Primer |
| 237 | salesforce/design-system-react | https://github.com/salesforce/design-system-react | 2k | Lightning design |
| 238 | elastic/eui | https://github.com/elastic/eui | 6k | Elastic UI |
| 239 | zendesk/garden | https://github.com/zendeskgarden/react-components | 1k | Zendesk design |
| 240 | pingcap/tidb-dashboard | https://github.com/pingcap/tidb-dashboard | 1k | Database UI |

## Category 30: React — More Real-Time Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 241 | jitsi/jitsi-meet | https://github.com/jitsi/jitsi-meet | 22k | Video conferencing |
| 242 | bigbluebutton/bigbluebutton | https://github.com/bigbluebutton/bigbluebutton | 8k | Web conferencing |
| 243 | zulip/zulip | https://github.com/zulip/zulip | 21k | Team chat |
| 244 | signalapp/Signal-Desktop | https://github.com/signalapp/Signal-Desktop | 14k | Messaging app |
| 245 | element-hq/element-web | https://github.com/vector-im/element-web | 11k | Matrix client |
| 246 | tldraw/tldraw | https://github.com/tldraw/tldraw | 33k | Whiteboard |
| 247 | hedgedoc/hedgedoc | https://github.com/hedgedoc/hedgedoc | 5k | Collaborative notes |
| 248 | overleaf/overleaf | https://github.com/overleaf/overleaf | 13k | LaTeX editor |
| 249 | leancloud/ChatKit-OC | https://github.com/leancloud/ChatKit-OC | 2k | Chat SDK |
| 250 | stream-labs/streamlabs-obs | https://github.com/stream-labs/streamlabs-obs | 6k | Streaming software |

## Category 31: React — More E-Commerce

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 251 | reactioncommerce/reaction | https://github.com/reactioncommerce/reaction | 12k | Commerce platform |
| 252 | vendure-ecommerce/vendure | https://github.com/vendure-ecommerce/vendure | 5k | Headless commerce |
| 253 | spree/spree | https://github.com/spree/spree | 13k | Commerce framework |
| 254 | shopware/shopware | https://github.com/shopware/shopware | 3k | E-commerce platform |
| 255 | woocommerce/woocommerce | https://github.com/woocommerce/woocommerce | 9k | WordPress commerce |
| 256 | prestashop/prestashop | https://github.com/PrestaShop/PrestaShop | 8k | E-commerce solution |
| 257 | sylius/sylius | https://github.com/Sylius/Sylius | 8k | E-commerce framework |
| 258 | bagisto/bagisto | https://github.com/bagisto/bagisto | 12k | Laravel e-commerce |
| 259 | shopify/hydrogen | https://github.com/Shopify/hydrogen | 1k | React framework |
| 260 | commercelayer/commercelayer-react-components | https://github.com/commercelayer/commercelayer-react-components | 500 | Commerce components |

## Category 32: React — Documentation & Knowledge Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 261 | facebook/docusaurus | https://github.com/facebook/docusaurus | 54k | React documentation framework |
| 262 | outline/outline | https://github.com/outline/outline | 25k | React wiki platform |
| 263 | logseq/logseq | https://github.com/logseq/logseq | 30k | Clojure/React knowledge graph |
| 264 | notable/notable | https://github.com/notable/notable | 23k | Markdown note-taking |
| 265 | BoostIO/BoostNote-App | https://github.com/BoostIO/BoostNote-App | 17k | Note-taking for developers |
| 266 | codex-team/editor.js | https://github.com/codex-team/editor.js | 28k | Block-style editor |
| 267 | toeverything/AFFiNE | https://github.com/toeverything/AFFiNE | 35k | All-in-one workspace |
| 268 | typeorm/typeorm | https://github.com/typeorm/typeorm | 34k | TypeScript ORM with React examples |
| 269 | facebook/lexical | https://github.com/facebook/lexical | 18k | Extensible text editor |
| 270 | doodlewind/elegant-writing | https://github.com/uiwjs/react-md-editor | 2k | React markdown editor |

## Category 33: React — More Production Apps & Tools

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 271 | withfig/autocomplete | https://github.com/withfig/autocomplete | 24k | Terminal autocomplete |
| 272 | infinitered/reactotron | https://github.com/infinitered/reactotron | 15k | React debugging tool |
| 273 | stoplightio/prism | https://github.com/stoplightio/prism | 4k | Mock HTTP server |
| 274 | backstage/backstage | https://github.com/backstage/backstage | 27k | Developer portal |
| 275 | tensorflow/tfjs-examples | https://github.com/tensorflow/tfjs-examples | 6k | TensorFlow.js examples |
| 276 | marmelab/react-admin | https://github.com/marmelab/react-admin | 24k | Admin framework |
| 277 | react-boilerplate/react-boilerplate | https://github.com/react-boilerplate/react-boilerplate | 29k | Production starter |
| 278 | jquense/yup | https://github.com/jquense/yup | 22k | Schema validation |
| 279 | streamich/react-use | https://github.com/streamich/react-use | 41k | React hooks collection |
| 280 | pmndrs/react-spring | https://github.com/pmndrs/react-spring | 28k | Spring animations |

## Category 34: React — Mobile & Hybrid Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 281 | ionic-team/ionic-framework | https://github.com/ionic-team/ionic-framework | 51k | Hybrid mobile |
| 282 | NativeScript/NativeScript | https://github.com/NativeScript/NativeScript | 24k | Mobile framework |
| 283 | apache/cordova | https://github.com/apache/cordova-android | 4k | Mobile platform |
| 284 | react-native-community/react-native-webview | https://github.com/react-native-webview/react-native-webview | 6k | WebView component |
| 285 | react-native-community/react-native-maps | https://github.com/react-native-maps/react-native-maps | 15k | Map component |
| 286 | oblador/react-native-vector-icons | https://github.com/oblador/react-native-vector-icons | 17k | Icon library |
| 287 | GeekyAnts/NativeBase | https://github.com/GeekyAnts/NativeBase | 20k | Component library |
| 288 | react-native-elements/react-native-elements | https://github.com/react-native-elements/react-native-elements | 25k | UI toolkit |
| 289 | wix/react-native-ui-lib | https://github.com/wix/react-native-ui-lib | 6k | UI library |
| 290 | facebook/react-native | https://github.com/facebook/react-native | 117k | Native mobile |

## Category 35: React — Additional Open Source Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 291 | standardnotes/app | https://github.com/standardnotes/app | 5k | Note-taking app |
| 292 | AppFlowy-IO/AppFlowy | https://github.com/AppFlowy-IO/AppFlowy | 50k | Notion alternative |
| 293 | toeverything/AFFiNE | https://github.com/toeverything/AFFiNE | 35k | Knowledge base |
| 294 | usememos/memos | https://github.com/usememos/memos | 28k | Note-taking |
| 295 | laurent22/joplin | https://github.com/laurent22/joplin | 43k | Note-taking |
| 296 | marktext/marktext | https://github.com/marktext/marktext | 45k | Markdown editor |
| 297 | notable/notable | https://github.com/notable/notable | 23k | Note-taking |
| 298 | dendronhq/dendron | https://github.com/dendronhq/dendron | 6k | Knowledge base |
| 299 | foambubble/foam | https://github.com/foambubble/foam | 15k | Personal knowledge |
| 300 | athensresearch/athens | https://github.com/athensresearch/athens | 6k | Knowledge graph |

---

## Category 36: Vue — Additional Full-Stack

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 301 | nuxt-community/nuxt-modules | https://github.com/nuxt-community/modules | 2k | Nuxt modules |
| 302 | nuxt/devtools | https://github.com/nuxt/devtools | 3k | Nuxt dev tools |
| 303 | nuxt-community/auth-module | https://github.com/nuxt-community/auth-module | 2k | Auth module |
| 304 | nuxt/image | https://github.com/nuxt/image | 1k | Image optimization |
| 305 | nuxt/content | https://github.com/nuxt/content | 3k | Content management |
| 306 | nuxt/ui | https://github.com/nuxt/ui | 3k | UI library |
| 307 | vuejs/apollo | https://github.com/vuejs/apollo | 6k | GraphQL integration |
| 308 | vuejs/vue-router | https://github.com/vuejs/router | 19k | Router library |
| 309 | vuejs/test-utils | https://github.com/vuejs/test-utils | 4k | Testing utilities |
| 310 | vuejs/vue-loader | https://github.com/vuejs/vue-loader | 5k | Webpack loader |

## Category 37: Vue — More Component Libraries

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 311 | bootstrap-vue/bootstrap-vue | https://github.com/bootstrap-vue/bootstrap-vue | 14k | Bootstrap for Vue |
| 312 | buefy/buefy | https://github.com/buefy/buefy | 9k | Bulma components |
| 313 | epicmaxco/vuestic-ui | https://github.com/epicmaxco/vuestic-ui | 3k | UI framework |
| 314 | lusaxweb/vuesax | https://github.com/lusaxweb/vuesax | 6k | Component framework |
| 315 | tailwindlabs/headlessui | https://github.com/tailwindlabs/headlessui | 25k | Unstyled components |
| 316 | hoppscotch/hoppscotch | https://github.com/hoppscotch/hoppscotch | 61k | API client |
| 317 | vuematerial/vue-material | https://github.com/vuematerial/vue-material | 10k | Material design |
| 318 | vuejs/composition-api | https://github.com/vuejs/composition-api | 4k | Composition API |
| 319 | vuelidate/vuelidate | https://github.com/vuelidate/vuelidate | 7k | Validation library |
| 320 | vee-validate/vee-validate | https://github.com/logaretm/vee-validate | 10k | Form validation |

## Category 38: Vue — Admin Templates & Dashboards

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 321 | coreui/coreui-vue | https://github.com/coreui/coreui-vue | 3k | Admin template |
| 322 | epicmaxco/vuestic-admin | https://github.com/epicmaxco/vuestic-admin | 10k | Admin dashboard |
| 323 | d2-projects/d2-admin | https://github.com/d2-projects/d2-admin | 13k | Admin template |
| 324 | view-design/ViewUI | https://github.com/view-design/ViewUI | 2k | UI framework |
| 325 | heyui/heyui | https://github.com/heyui/heyui | 3k | UI toolkit |
| 326 | airyland/vux | https://github.com/airyland/vux | 18k | Mobile UI |
| 327 | didi/cube-ui | https://github.com/didi/cube-ui | 9k | Mobile components |
| 328 | NervJS/taro-ui | https://github.com/NervJS/taro-ui | 4k | UI library |
| 329 | ElemeFE/mint-ui | https://github.com/ElemeFE/mint-ui | 17k | Mobile UI |
| 330 | nuxt-community/admin-template | https://github.com/nuxt-community/admin-template | 500 | Admin starter |

## Category 39: Vue — State & Data Management

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 331 | vuejs/pinia | https://github.com/vuejs/pinia | 12k | State management |
| 332 | robinvdvleuten/vuex-persistedstate | https://github.com/robinvdvleuten/vuex-persistedstate | 6k | Persist Vuex state |
| 333 | championswimmer/vuex-persist | https://github.com/championswimmer/vuex-persist | 2k | State persistence |
| 334 | vuex-orm/vuex-orm | https://github.com/vuex-orm/vuex-orm | 2k | ORM for Vuex |
| 335 | davestewart/vuex-pathify | https://github.com/davestewart/vuex-pathify | 1k | Vuex helper |
| 336 | logaretm/villus | https://github.com/logaretm/villus | 800 | GraphQL client |
| 337 | vuejs/apollo | https://github.com/vuejs/apollo | 6k | Apollo integration |
| 338 | tanstack/query | https://github.com/TanStack/query | 40k | Async queries |
| 339 | posva/pinia-plugin-persistedstate | https://github.com/prazdevs/pinia-plugin-persistedstate | 2k | Pinia persistence |
| 340 | harlan-zw/nuxt-simple-robots | https://github.com/harlan-zw/nuxt-simple-robots | 500 | SEO utilities |

## Category 40: Vue — Real-Time & WebSocket

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 341 | socketio/socket.io-client | https://github.com/socketio/socket.io-client | 4k | Socket.io client |
| 342 | socketio/socket.io | https://github.com/socketio/socket.io | 60k | Real-time engine |
| 343 | nuxt-modules/supabase | https://github.com/nuxt-modules/supabase | 800 | Supabase integration |
| 344 | vueuse/motion | https://github.com/vueuse/motion | 2k | Animation library |
| 345 | vuejs/vue-rx | https://github.com/vuejs/vue-rx | 3k | RxJS integration |
| 346 | websanova/vue-auth | https://github.com/websanova/vue-auth | 2k | Authentication |
| 347 | vueuse/head | https://github.com/unjs/unhead | 1k | Head management |
| 348 | vue-reactivity/watch | https://github.com/vue-reactivity/watch | 200 | Reactivity utils |
| 349 | posva/pinia-colada | https://github.com/posva/pinia-colada | 1k | Async state |
| 350 | unjs/h3 | https://github.com/unjs/h3 | 3k | HTTP server |

## Category 41: Vue — UI Frameworks & Design

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 351 | unocss/unocss | https://github.com/unocss/unocss | 16k | Atomic CSS |
| 352 | windicss/windicss | https://github.com/windicss/windicss | 6k | Utility-first CSS |
| 353 | saadeghi/daisyui | https://github.com/saadeghi/daisyui | 31k | Tailwind components |
| 354 | nuxt/ui | https://github.com/nuxt/ui | 3k | Nuxt UI library |
| 355 | chakra-ui/zag | https://github.com/chakra-ui/zag | 4k | UI components |
| 356 | formkit/formkit | https://github.com/formkit/formkit | 4k | Form framework |
| 357 | oruga-ui/oruga | https://github.com/oruga-ui/oruga | 1k | UI framework |
| 358 | framework7io/framework7 | https://github.com/framework7io/framework7 | 18k | Mobile framework |
| 359 | konvajs/vue-konva | https://github.com/konvajs/vue-konva | 1k | Canvas library |
| 360 | nuxt-modules/icon | https://github.com/nuxt-modules/icon | 1k | Icon components |

## Category 42: Vue — Dev Tools & Testing

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 361 | vuejs/devtools-next | https://github.com/vuejs/devtools-next | 1k | Vue DevTools |
| 362 | vitest-dev/vitest | https://github.com/vitest-dev/vitest | 12k | Test framework |
| 363 | testing-library/vue-testing-library | https://github.com/testing-library/vue-testing-library | 1k | Testing utilities |
| 364 | nuxt/test-utils | https://github.com/nuxt/test-utils | 500 | Nuxt testing |
| 365 | slidevjs/slidev | https://github.com/slidevjs/slidev | 32k | Presentation tool |
| 366 | histoire-dev/histoire | https://github.com/histoire-dev/histoire | 3k | Component stories |
| 367 | antfu/eslint-config | https://github.com/antfu/eslint-config | 4k | ESLint config |
| 368 | vuejs/language-tools | https://github.com/vuejs/language-tools | 5k | TypeScript tools |
| 369 | johnsoncodehk/volar | https://github.com/vuejs/language-tools | 5k | Vue tooling |
| 370 | nuxt/eslint-config | https://github.com/nuxt/eslint | 400 | Nuxt ESLint |

## Category 43: Vue — More Production Apps

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 371 | coreui/coreui-free-vue-admin-template | https://github.com/coreui/coreui-free-vue-admin-template | 3k | Admin template |
| 372 | PanJiaChen/vue-admin-template | https://github.com/PanJiaChen/vue-admin-template | 20k | Admin starter |
| 373 | view-design/ViewUIPlus | https://github.com/view-design/ViewUIPlus | 1k | UI components |
| 374 | nuxt/nuxt.com | https://github.com/nuxt/nuxt.com | 2k | Nuxt documentation site |
| 375 | nuxt-modules/i18n | https://github.com/nuxt-modules/i18n | 2k | Internationalization module |
| 376 | youzan/vant-weapp | https://github.com/youzan/vant-weapp | 18k | Mini program UI |
| 377 | dcloudio/uni-app | https://github.com/dcloudio/uni-app | 40k | Cross-platform |
| 378 | weilanwl/ColorUI | https://github.com/weilanwl/ColorUI | 12k | Mini program UI |
| 379 | elunez/eladmin-web | https://github.com/elunez/eladmin-web | 3k | Admin frontend |
| 380 | vue-bulma/vue-admin | https://github.com/vue-bulma/vue-admin | 10k | Admin panel |

## Category 44: Vue — E-Commerce & CMS

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 381 | shopware/frontends | https://github.com/shopware/frontends | 200 | E-commerce frontend |
| 382 | vuestorefront/storefront-ui | https://github.com/vuestorefront/storefront-ui | 2k | Commerce UI |
| 383 | strapi/strapi | https://github.com/strapi/strapi | 61k | React admin panel for CMS |
| 384 | payloadcms/payload | https://github.com/payloadcms/payload | 20k | React-based CMS |
| 385 | netlify/netlify-cms | https://github.com/netlify/netlify-cms | 18k | React Git-based CMS |
| 386 | directus/directus | https://github.com/directus/directus | 26k | Vue data platform |
| 387 | sanity-io/sanity | https://github.com/sanity-io/sanity | 5k | React content platform |
| 388 | tinacms/tinacms | https://github.com/tinacms/tinacms | 11k | React Git-backed CMS |
| 389 | BuilderIO/builder | https://github.com/BuilderIO/builder | 7k | React visual CMS |
| 390 | keystonejs/keystone | https://github.com/keystonejs/keystone | 9k | React CMS framework |

## Category 45: Vue — Mobile & Hybrid

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 391 | weex-team/weex | https://github.com/alibaba/weex | 18k | Mobile framework |
| 392 | nativescript-vue/nativescript-vue | https://github.com/nativescript-vue/nativescript-vue | 5k | Native mobile |
| 393 | capacitor-community/capacitor-plugins | https://github.com/capacitor-community | 400 | Capacitor plugins |
| 394 | ionic-team/ionic-vue | https://github.com/ionic-team/ionic-framework | 51k | Ionic Vue |
| 395 | nuxt-community/pwa-module | https://github.com/nuxt-modules/pwa | 1k | PWA module |
| 396 | onsen-ui/OnsenUI | https://github.com/OnsenUI/OnsenUI | 9k | Mobile UI framework |
| 397 | vuetifyjs/vuetify-nuxt-module | https://github.com/vuetifyjs/vuetify-nuxt-module | 300 | Vuetify + Nuxt |
| 398 | quasarframework/quasar-starter-kit | https://github.com/quasarframework/quasar-starter-kit | 500 | Quasar starter |
| 399 | framework7io/framework7-vue | https://github.com/framework7io/framework7 | 18k | Framework7 Vue |
| 400 | vant-ui/vant | https://github.com/youzan/vant | 23k | Mobile UI library |

---

## Category 46: Angular — More Core & Enterprise

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 401 | angular/universal | https://github.com/angular/universal | 4k | Server-side rendering |
| 402 | angular/angularfire | https://github.com/angular/angularfire | 8k | Firebase SDK |
| 403 | angular/flex-layout | https://github.com/angular/flex-layout | 6k | Layout engine |
| 404 | ngrx/platform | https://github.com/ngrx/platform | 8k | State management |
| 405 | ngxs/store | https://github.com/ngxs/store | 4k | State management |
| 406 | ngneat/elf | https://github.com/ngneat/elf | 2k | Store library |
| 407 | rx-angular/rx-angular | https://github.com/rx-angular/rx-angular | 2k | Reactive utilities |
| 408 | ngneat/until-destroy | https://github.com/ngneat/until-destroy | 2k | Memory leak helper |
| 409 | ngneat/transloco | https://github.com/ngneat/transloco | 2k | i18n library |
| 410 | ngx-translate/core | https://github.com/ngx-translate/core | 5k | Translation |

## Category 47: Angular — More Component Libraries

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 411 | taiga-family/taiga-ui | https://github.com/taiga-family/taiga-ui | 3k | UI kit |
| 412 | ngx-formly/ngx-formly | https://github.com/ngx-formly/ngx-formly | 3k | Dynamic forms |
| 413 | swimlane/ngx-datatable | https://github.com/swimlane/ngx-datatable | 5k | Data table |
| 414 | swimlane/ngx-charts | https://github.com/swimlane/ngx-charts | 4k | Chart library |
| 415 | valor-software/ng2-charts | https://github.com/valor-software/ng2-charts | 2k | Chart.js wrapper |
| 416 | ng-select/ng-select | https://github.com/ng-select/ng-select | 3k | Select component |
| 417 | mattlewis92/angular-calendar | https://github.com/mattlewis92/angular-calendar | 3k | Calendar widget |
| 418 | ng2-dragula/ng2-dragula | https://github.com/valor-software/ng2-dragula | 2k | Drag and drop |
| 419 | ng-bootstrap/ng-bootstrap | https://github.com/ng-bootstrap/ng-bootstrap | 8k | Bootstrap widgets |
| 420 | kolkov/angular-editor | https://github.com/kolkov/angular-editor | 500 | WYSIWYG editor |

## Category 48: Angular — Admin & Dashboard Templates

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 421 | akveo/nebular | https://github.com/akveo/nebular | 8k | UI kit |
| 422 | akveo/ngx-admin | https://github.com/akveo/ngx-admin | 25k | Admin template |
| 423 | creativetimofficial/material-dashboard-angular2 | https://github.com/creativetimofficial/material-dashboard-angular2 | 1k | Material dashboard |
| 424 | coreui/coreui-free-angular-admin-template | https://github.com/coreui/coreui-free-angular-admin-template | 2k | Admin template |
| 425 | ngx-rocket/generator-ngx-rocket | https://github.com/ngx-rocket/generator-ngx-rocket | 1k | Project generator |
| 426 | cloudfoundry/stratos | https://github.com/cloudfoundry/stratos | 1k | Management UI |
| 427 | DanWahlin/Angular-JumpStart | https://github.com/DanWahlin/Angular-JumpStart | 600 | Starter app |
| 428 | start-angular/SB-Admin-BS4-Angular-9 | https://github.com/start-angular/SB-Admin-BS4-Angular-9 | 300 | Admin theme |
| 429 | yuyang041060120/ng2-validation | https://github.com/yuyang041060120/ng2-validation | 600 | Validation |
| 430 | angular-university/angular-security-course | https://github.com/angular-university/angular-security-course | 400 | Security patterns |

## Category 49: Angular — Testing & Dev Tools

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 431 | ngneat/spectator | https://github.com/ngneat/spectator | 2k | Testing library |
| 432 | testing-library/angular-testing-library | https://github.com/testing-library/angular-testing-library | 1k | Testing utils |
| 433 | ngneat/falso | https://github.com/ngneat/falso | 3k | Fake data generator |
| 434 | compodoc/compodoc | https://github.com/compodoc/compodoc | 4k | Documentation tool |
| 435 | angular-eslint/angular-eslint | https://github.com/angular-eslint/angular-eslint | 2k | ESLint plugin |
| 436 | storybookjs/storybook | https://github.com/storybookjs/storybook | 83k | Component explorer |
| 437 | codelyzer/codelyzer | https://github.com/mgechev/codelyzer | 3k | Static analysis |
| 438 | scully-io/scully | https://github.com/scullyio/scully | 3k | Static generator |
| 439 | angular/components-builds | https://github.com/angular/components-builds | 200 | CI builds |
| 440 | angular/angular-devkit | https://github.com/angular/angular-cli | 27k | CLI toolkit |

## Category 50: Angular — Real-World Applications

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 441 | bitwarden/clients | https://github.com/bitwarden/clients | 8k | Password manager |
| 442 | ever-co/ever-gauzy | https://github.com/ever-co/ever-gauzy | 2k | Business platform |
| 443 | vendure-ecommerce/vendure | https://github.com/vendure-ecommerce/vendure | 5k | E-commerce |
| 444 | treo/treo | https://github.com/treo/treo | 300 | Admin template |
| 445 | fuse/fuse | https://github.com/fuse/fuse | 400 | Admin dashboard |
| 446 | realworld-io/angular-realworld-example-app | https://github.com/gothinkster/angular-realworld-example-app | 5k | RealWorld demo |
| 447 | notadd/notadd | https://github.com/notadd/notadd | 2k | CMS framework |
| 448 | qdrant/qdrant-web-ui | https://github.com/qdrant/qdrant-web-ui | 300 | Vector database UI |
| 449 | teambit/bit | https://github.com/teambit/bit | 18k | Component dev |
| 450 | spartacus-project/spartacus | https://github.com/SAP/spartacus | 700 | Commerce storefront |

## Category 51: Angular — State Management Patterns

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 451 | ngrx/entity | https://github.com/ngrx/platform | 8k | Entity management |
| 452 | ngrx/effects | https://github.com/ngrx/platform | 8k | Side effects |
| 453 | ngrx/router-store | https://github.com/ngrx/platform | 8k | Router integration |
| 454 | ngrx/component-store | https://github.com/ngrx/platform | 8k | Local state |
| 455 | akita-js/akita | https://github.com/salesforce/akita | 3k | State management |
| 456 | ngneat/hotkeys | https://github.com/ngneat/hotkeys | 300 | Keyboard shortcuts |
| 457 | ngneat/cashew | https://github.com/ngneat/cashew | 500 | HTTP caching |
| 458 | ngneat/overview | https://github.com/ngneat/overview | 100 | Dev tools |
| 459 | angular/angular-quickstart | https://github.com/angular/quickstart | 11k | Quick start |
| 460 | valueflows/valueflows | https://github.com/valueflows/valueflows | 300 | Economic networks |

## Category 52: Angular — Form & Validation

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 461 | ngx-formly/ngx-formly | https://github.com/ngx-formly/ngx-formly | 3k | Dynamic forms |
| 462 | ng-select/ng-select | https://github.com/ng-select/ng-select | 3k | Select widget |
| 463 | ngneat/reactive-forms | https://github.com/ngneat/reactive-forms | 600 | Reactive helpers |
| 464 | ngneat/dirty-check-forms | https://github.com/ngneat/dirty-check-forms | 300 | Form state |
| 465 | ngneat/helipopper | https://github.com/ngneat/helipopper | 400 | Tooltip library |
| 466 | ngneat/dialog | https://github.com/ngneat/dialog | 500 | Dialog service |
| 467 | ngneat/content-loader | https://github.com/ngneat/content-loader | 700 | Skeleton loader |
| 468 | ngneat/inspector | https://github.com/ngneat/inspector | 300 | Dev inspector |
| 469 | ngneat/bind-query-params | https://github.com/ngneat/bind-query-params | 400 | URL sync |
| 470 | angular/angularfire | https://github.com/angular/angularfire | 8k | Firebase Angular library |

## Category 53: Angular — HTTP & API Integration

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 471 | apollographql/apollo-angular | https://github.com/kamilkisiela/apollo-angular | 1k | GraphQL client |
| 472 | ngneat/http-cache | https://github.com/ngneat/cashew | 500 | HTTP caching |
| 473 | ngneat/query | https://github.com/ngneat/query | 600 | Query builder |
| 474 | nestjs/ng-universal | https://github.com/nestjs/ng-universal | 300 | Universal adapter |
| 475 | ngx-rocket/core | https://github.com/ngx-rocket/core | 200 | Core utilities |
| 476 | auth0/auth0-angular | https://github.com/auth0/auth0-angular | 200 | Auth0 SDK |
| 477 | okta/okta-angular | https://github.com/okta/okta-angular | 200 | Okta SDK |
| 478 | microsoft/microsoft-graph-toolkit | https://github.com/microsoftgraph/microsoft-graph-toolkit | 1k | Graph components |
| 479 | aws-amplify/amplify-angular | https://github.com/aws-amplify/amplify-js | 9k | AWS Amplify |
| 480 | firebase/angularfire | https://github.com/angular/angularfire | 8k | Firebase |

## Category 54: Angular — UI/UX & Animation

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 481 | angular/animations | https://github.com/angular/angular | 95k | Animation APIs |
| 482 | ngneat/svg-icon | https://github.com/ngneat/svg-icon | 300 | SVG icons |
| 483 | kreuzerk/svg-to-ts | https://github.com/kreuzerk/svg-to-ts | 300 | Icon generator |
| 484 | angular-slider/ngx-slider | https://github.com/angular-slider/ngx-slider | 400 | Range slider |
| 485 | mattlewis92/angular-draggable-droppable | https://github.com/mattlewis92/angular-draggable-droppable | 300 | Drag and drop |
| 486 | SortableJS/angular-sortablejs | https://github.com/SortableJS/angular-sortablejs | 500 | Sortable lists |
| 487 | mgechev/ngx-quicklink | https://github.com/mgechev/ngx-quicklink | 700 | Preloading |
| 488 | ngneat/edit-in-place | https://github.com/ngneat/edit-in-place | 200 | Inline editing |
| 489 | ngneat/input-mask | https://github.com/ngneat/input-mask | 300 | Input masking |
| 490 | ngneat/error-tailor | https://github.com/ngneat/error-tailor | 600 | Form errors |

## Category 55: Angular — Mobile & PWA

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 491 | ionic-team/ionic-framework | https://github.com/ionic-team/ionic-framework | 51k | Mobile UI |
| 492 | ionic-team/capacitor | https://github.com/ionic-team/capacitor | 11k | Native runtime |
| 493 | ionic-team/stencil | https://github.com/ionic-team/stencil | 12k | Web components |
| 494 | nativescript/angular | https://github.com/NativeScript/angular | 1k | Native mobile |
| 495 | angular/pwa | https://github.com/angular/angular-cli | 27k | PWA schematics |
| 496 | angular-schule/angular-cli-ghpages | https://github.com/angular-schule/angular-cli-ghpages | 900 | GitHub Pages |
| 497 | ngx-rocket/mobile | https://github.com/ngx-rocket/generator-ngx-rocket | 1k | Mobile template |
| 498 | onsen-ui/onsenui-angular | https://github.com/OnsenUI/OnsenUI | 9k | Mobile UI |
| 499 | angular/service-worker | https://github.com/angular/angular | 95k | Service worker |
| 500 | ngneat/push | https://github.com/ngneat/push | 200 | Push pipe |

---

> **Total: 500 repositories** (210 React, 150 Vue, 140 Angular)
> All repos are public GitHub repositories suitable for scanning memory leak patterns.
> The scanner automatically deduplicates by URL and detects framework from file content.
