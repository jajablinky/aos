import React from "react";
import { Box, Text } from "ink";

const h = React.createElement;
const tabs = ["General", "Display", "Network"];

const tabContent = {
  General: ["Theme: Default", "History size: 100", "Shell: Lua"],
  Display: ["Verbose tool output", "Status bar: On", "Cursor: Block"],
  Network: ["AO URL: Default", "Scheduler: Mainnet", "Gateway: Default"],
};

export default function ConfigModal({ selectedTab }) {
  return h(
    Box,
    {
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 2,
      paddingY: 1,
      flexDirection: "column",
    },
    h(Text, { color: "cyan" }, "Settings"),
    h(
      Box,
      { marginTop: 1 },
      tabs.map((tab) =>
        h(
          Box,
          { key: tab, marginRight: 2 },
          h(
            Text,
            { color: tab === selectedTab ? "green" : "gray" },
            `${tab === selectedTab ? "▸ " : "  "}${tab}`,
          ),
        ),
      ),
    ),
    h(
      Box,
      { marginTop: 1, flexDirection: "column" },
      tabContent[selectedTab].map((line) => h(Text, { key: line }, line)),
    ),
    h(Text, { dimColor: true }, "Tab to switch • Esc to close"),
  );
}
