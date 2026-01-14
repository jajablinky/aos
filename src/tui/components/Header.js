/**
 * Header Component
 * 
 * Displays the top status bar with process information and controls
 */

import React from 'react'
import { Box, Text } from 'ink'

const Header = ({ processId, dryRunMode, showSidebar, onToggleSidebar }) => {

  const getStatusColor = () => {
    if (dryRunMode) return 'yellow'
    return 'green'
  }

  const formatProcessId = () => {
    if (processId.length > 12) {
      return `${processId.slice(0, 6)}...${processId.slice(-4)}`
    }
    return processId
  }

  const getStatusText = () => {
    if (dryRunMode) return '[DRY RUN]'
    return '[CONNECTED]'
  }

  return React.createElement(Box, {
    borderStyle: "single",
    borderColor: getStatusColor(),
    flexDirection: "row",
    justifyContent: "space-between",
    paddingX: 1
  }, [
    React.createElement(Box, {
      flexDirection: "row",
      alignItems: "center"
    }, [
      React.createElement(Text, { bold: true, color: "blue" }, "AOS"),
      React.createElement(Text, " • "),
      React.createElement(Text, { color: "cyan" }, formatProcessId()),
      React.createElement(Text, " • "),
      React.createElement(Text, { color: getStatusColor() }, getStatusText())
    ]),

    React.createElement(Box, {
      flexDirection: "row",
      alignItems: "center"
    }, [
      React.createElement(Text, {
        dimColor: true
      }, `Ctrl+B: ${showSidebar ? 'Hide' : 'Show'} Sidebar | /: Help | Ctrl+C: Exit`)
    ])
  ])
}

export default Header