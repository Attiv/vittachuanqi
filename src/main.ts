import { createApp } from "vue";
import Vant from "vant";
import App from "./App.vue";
import { registerSW } from "virtual:pwa-register";
import "vant/lib/index.css";
import "./styles.css";

registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (import.meta.env.DEV) {
      console.info("PWA SW registered:", swUrl, registration);
    }
  },
  onRegisterError(error) {
    console.error("PWA SW register failed:", error);
  },
});

createApp(App).use(Vant).mount("#app");
