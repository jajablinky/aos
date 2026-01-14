/**
 * Scrollback Component
 * 
 * Displays command history and output messages with scrolling
 */

import React, { useRef, useEffect } from 'react'
import { Box, Text } from 'ink'

const Scrollback = ({ messages, maxMessages = 1000 }) => {
  const scrollRef = useRef(null)

  // Note: Auto-scrolling will be handled by Ink automatically

  const formatTimestamp = (timestamp) => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  const getMessageColor = (type) => {
    switch (type) {
      case 'user':
        return 'green'
      case 'error':
        return 'red'
      case 'output':
        return 'white'
      case 'info':
        return 'blue'
      case 'help':
        return 'yellow'
      default:
        return 'gray'
    }
  }

  const getMessagePrefix = (type) => {
    switch (type) {
      case 'user':
        return '>'
      case 'error':
        return '✗'
      case 'output':
        return '→'
      case 'info':
        return 'ℹ'
      case 'help':
        return '?'
      default:
        return '•'
    }
  }

  const formatMessage = (message) => {
    let content = message.content.toString()

    // For now, don't worry about line wrapping to avoid complexity
    return [content]
  }

  // Show last 50 messages to avoid overwhelming the display
  const visibleMessages = messages.slice(-50)

  if (visibleMessages.length === 0) {
    return React.createElement(Box, {
      flexDirection: "column",
      flexGrow: 1,
      paddingX: 1,
      borderStyle: "single",
      borderDimColor: true,
      borderColor: "gray"
    }, [
      React.createElement(Box, {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center"
      }, [
        React.createElement(Text, {
          dimColor: true
        }, "No messages yet. Type a command to begin.")
      ])
    ])
  }

  return React.createElement(Box, {
    flexDirection: "column",
    flexGrow: 1,
    paddingX: 1,
    borderStyle: "single",
    borderDimColor: true,
    borderColor: "gray"
  }, visibleMessages.map((message, index) => {
    const lines = formatMessage(message)
    const isFirstMessage = index === 0
    const isLastMessage = index === visibleMessages.length - 1

    return React.createElement(Box, {
      key: index,
      flexDirection: "column",
      marginBottom: isLastMessage ? 0 : 1
    }, lines.map((line, lineIndex) => {
      const showTimestamp = lineIndex === 0
      const prefix = lineIndex === 0 ? getMessagePrefix(message.type) : ' '

      return React.createElement(Box, {
        key: lineIndex,
        flexDirection: "row",
        width: "100%"
      }, [
        showTimestamp && React.createElement(Text, {
          color: "gray",
          dimColor: true
        }, `[${formatTimestamp(message.timestamp)}]`),
        showTimestamp && React.createElement(Text, " "),
        React.createElement(Text, {
          color: getMessageColor(message.type)
        }, prefix),
        React.createElement(Text, " "),
        React.createElement(Text, {
          color: getMessageColor(message.type)
        }, line)
      ])
    }))
  }))
}

export default Scrollback