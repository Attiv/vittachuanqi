import { createApp } from "vue";
import Vant from "vant";
import App from "./App.vue";
import "vant/lib/index.css";
import "./styles.css";

createApp(App).use(Vant).mount("#app");
