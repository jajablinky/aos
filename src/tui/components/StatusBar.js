import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";

const h = React.createElement;

export default function StatusBar({
  processId,
  isConnected,
  dryRunMode,
  showTools,
  prompt,
}) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return h(
    Box,
    { justifyContent: "space-between", borderStyle: "round", paddingX: 1 },
    h(
      Text,
      { color: isConnected ? "green" : "yellow" },
      isConnected ? "Connected" : "Connecting",
    ),
    h(Text, { color: "gray" }, prompt),
    h(
      Text,
      { color: dryRunMode ? "red" : "gray" },
      dryRunMode ? "Dryrun" : "Live",
    ),
    h(
      Text,
      { color: showTools ? "yellow" : "gray" },
      showTools ? "Verbose" : "Quiet",
    ),
    h(
      Text,
      { color: "cyan" },
      processId ? processId.slice(0, 10) + "…" : "No Process",
    ),
    h(Text, { color: "gray" }, time.toLocaleTimeString()),
  );
}
