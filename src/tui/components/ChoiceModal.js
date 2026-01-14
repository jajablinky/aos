import React from "react";
import { Box, Text } from "ink";

const h = React.createElement;

export default function ChoiceModal({ message, choices, selectedIndex }) {
  return h(
    Box,
    {
      borderStyle: "round",
      borderColor: "green",
      paddingX: 2,
      paddingY: 1,
      flexDirection: "column",
    },
    h(Text, { color: "green" }, message),
    h(
      Box,
      { marginTop: 1, flexDirection: "column" },
      choices.map((choice, index) =>
        h(
          Text,
          {
            key: choice.value,
            color: index === selectedIndex ? "cyan" : "white",
          },
          `${index === selectedIndex ? "➤ " : "  "}${choice.title}`,
        ),
      ),
    ),
    h(
      Text,
      { dimColor: true },
      "↑/↓ to move • Enter to select • Esc to cancel",
    ),
  );
}
