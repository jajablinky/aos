import React from "react";
import { Box, Text } from "ink";

const h = React.createElement;

export default function InputBar({ prompt, value }) {
  return h(
    Box,
    null,
    h(Text, { color: "magenta" }, prompt),
    h(Text, null, value),
    h(Text, { dimColor: true }, "█"),
  );
}
