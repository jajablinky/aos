import React from "react";
import { render } from "ink";
import App from "./App.js";

export default function runTui({ engine, luaData }) {
  render(React.createElement(App, { engine, luaData }), { exitOnCtrlC: false });
}
