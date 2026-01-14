/**
 * Sidebar Component
 * 
 * Displays additional information and controls
 */

import React from 'react'
import { Box, Text } from 'ink'

const Sidebar = ({ processId, dryRunMode, messageCount }) => {
  const formatProcessId = () => {
    if (processId.length > 15) {
      return `${processId.slice(0, 8)}...${processId.slice(-6)}`
    }
    return processId
  }

  return React.createElement(Box, {
    flexDirection: "column",
    width: 30,
    borderStyle: "single",
    borderColor: "blue",
    paddingX: 1
  }, [
    React.createElement(Box, {
      flexDirection: "column",
      marginBottom: 1
    }, [
      React.createElement(Text, { bold: true, color: "blue" }, "Process Info"),
      React.createElement(Box, {
        flexDirection: "column",
        marginTop: 1
      }, [
        React.createElement(Text, `ID: ${formatProcessId()}`),
        React.createElement(Text, `Messages: ${messageCount}`),
        React.createElement(Text, `Dry Run: ${dryRunMode ? 'ON' : 'OFF'}`)
      ])
    ]),

    React.createElement(Box, {
      flexDirection: "column",
      marginBottom: 1
    }, [
      React.createElement(Text, { bold: true, color: "blue" }, "Quick Commands"),
      React.createElement(Box, {
        flexDirection: "column",
        marginTop: 1
      }, [
        React.createElement(Text, { color: "gray" }, ".help"),
        React.createElement(Text, { color: "gray" }, ".live / .pause"),
        React.createElement(Text, { color: "gray" }, ".dryrun"),
        React.createElement(Text, { color: "gray" }, ".monitor / .unmonitor"),
        React.createElement(Text, { color: "gray" }, ".load <file>"),
        React.createElement(Text, { color: "gray" }, ".exit")
      ])
    ]),

    React.createElement(Box, {
      flexDirection: "column",
      marginBottom: 1
    }, [
      React.createElement(Text, { bold: true, color: "blue" }, "Shortcuts"),
      React.createElement(Box, {
        flexDirection: "column",
        marginTop: 1
      }, [
        React.createElement(Text, { color: "gray" }, "/ - Help modal"),
        React.createElement(Text, { color: "gray" }, "↑/↓ - History"),
        React.createElement(Text, { color: "gray" }, "Ctrl+B - Toggle sidebar"),
        React.createElement(Text, { color: "gray" }, "Ctrl+C - Exit")
      ])
    ]),

    React.createElement(Box, {
      flexDirection: "column"
    }, [
      React.createElement(Text, { bold: true, color: "blue" }, "Blueprints"),
      React.createElement(Box, {
        flexDirection: "column",
        marginTop: 1
      }, [
        React.createElement(Text, { color: "dim" }, "Quick access to"),
        React.createElement(Text, { color: "dim" }, "blueprint library"),
        React.createElement(Text, { color: "dim" }, "(coming soon)")
      ])
    ])
  ])
}

export default Sidebar