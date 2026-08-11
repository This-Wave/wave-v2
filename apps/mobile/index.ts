import { registerRootComponent } from "expo";
import App from "./App";

// A local entry point instead of the `expo/AppEntry` convention — that file's
// own relative import ("../../App") assumes node_modules/expo isn't hoisted,
// which breaks in this npm-workspaces monorepo (it resolves to the repo root
// instead of apps/mobile). Owning the entry point here sidesteps that.
registerRootComponent(App);
