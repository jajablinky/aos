import React from "react";
import { Box, Text } from "ink";

const h = React.createElement;
const options = ["Allow once", "Always allow", "Deny"];

export default function PermissionModal({ selectedIndex }) {
  return h(
    Box,
    {
      borderStyle: "round",
      borderColor: "yellow",
      paddingX: 2,
      paddingY: 1,
      flexDirection: "column",
    },
    h(Text, { color: "yellow" }, "Permission Required"),
    h(Text, { dimColor: true }, "Simulated prompt for dangerous operations."),
    h(
      Box,
      { marginTop: 1, flexDirection: "column" },
      options.map((option, index) =>
        h(
          Text,
          { key: option, color: index === selectedIndex ? "green" : "white" },
          `${index === selectedIndex ? "➤ " : "  "}${option}`,
        ),
      ),
    ),
    h(
      Text,
      { dimColor: true },
      "Tab to cycle • Enter to confirm • Esc to close",
    ),
  );
}
