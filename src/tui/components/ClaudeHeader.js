import React from "react";
import { Box, Text } from "ink";

const h = React.createElement;

const dots = "…………………………………………………………………………………………………………………………………………………………";
const divider =
  "╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌";

const artLines = [
  "            ░░░░░░",
  "    ░░░   ░░░░░░░░░░",
  "   ░░░░░░░░░░░░░░░░░░░",
  "",
  "                           ░░░░                     ██",
  "                         ░░░░░░░░░░               ██▒▒██",
  "                                            ▒▒      ██   ▒",
  "       █████████                          ▒▒░░▒▒      ▒ ▒▒",
  "      ██▄█████▄██                           ▒▒         ▒▒",
  "       █████████                           ░          ▒",
  "…………………█ █   █ █……………………………………………………………………░…………………………▒…………",
];

export default function ClaudeHeader({
  version,
  processId,
  isLegacyMode,
  variant,
}) {
  const modeLabel = isLegacyMode ? "Legacy" : "Mainnet";
  const variantLabel = variant ? `(${variant})` : "";

  return h(
    Box,
    { flexDirection: "column" },
    h(Text, null, `Welcome to AOS v${version} ${variantLabel}`),
    h(Text, { dimColor: true }, dots),
    h(Text, null, ""),
    ...artLines.map((line, index) =>
      h(Text, { key: `${line}-${index}` }, line),
    ),
    h(Text, null, ""),
    h(
      Box,
      { flexDirection: "column" },
      h(Text, null, " 1  session.status {"),
      h(
        Text,
        { color: "red" },
        ` 2 -  mode: ${isLegacyMode ? "Mainnet" : "Legacy"}`,
      ),
      h(Text, { color: "green" }, ` 2 +  mode: ${modeLabel}`),
      h(Text, null, ` 3  process: ${processId ? processId : "pending"}`),
      h(Text, null, " 4 }"),
    ),
    h(Text, null, divider),
    h(Text, { dimColor: true }, " Syntax theme: GitHub (ctrl+t to disable)"),
  );
}
