import { defineRoute, initRouter } from "./ui/router.js";
import { renderRoster } from "./ui/screens/roster.js";
import { renderCreator } from "./ui/screens/creator.js";
import { renderSheet } from "./ui/screens/sheet.js";

const app = document.getElementById("app");

defineRoute("/roster", () => renderRoster(app));
defineRoute("/creator", () => renderCreator(app));
defineRoute("/sheet/:id", ({ id }) => renderSheet(app, id));

initRouter();
