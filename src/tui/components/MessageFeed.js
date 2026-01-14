import React from "react";
import { Box, Text } from "ink";

const h = React.createElement;

const roleStyles = {
  user: { label: "You", color: "cyan" },
  assistant: { label: "AOS", color: "green" },
  tool: { label: "Tool", color: "yellow" },
  system: { label: "System", color: "gray" },
  error: { label: "Error", color: "red" },
};

function renderContent(content) {
  if (content === null || content === undefined) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  try {
    return JSON.stringify(content, null, 2);
  } catch (error) {
    return String(content);
  }
}

export default function MessageFeed({ blocks, showTools }) {
  return h(
    Box,
    { flexDirection: "column", flexGrow: 1 },
    blocks.map((block) => {
      const role = roleStyles[block.role] || roleStyles.system;
      const content = renderContent(block.content);

      if (block.role === "tool" && !showTools) {
        return h(
          Box,
          { key: block.id, marginBottom: 1 },
          h(
            Text,
            { dimColor: true },
            `[tool] ${block.title || content.split("\n")[0]}`,
          ),
        );
      }

      return h(
        Box,
        { key: block.id, flexDirection: "column", marginBottom: 1 },
        h(Text, { color: role.color }, role.label),
        h(Text, null, content),
      );
    }),
  );
}
