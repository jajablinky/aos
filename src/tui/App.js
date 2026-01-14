/**
 * Main TUI Application Component for AOS
 * 
 * This React component renders the terminal-based user interface
 * using Ink for CLI-based React rendering.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import Header from './components/Header.js'
import Scrollback from './components/Scrollback.js'
import Input from './components/Input.js'
import Sidebar from './components/Sidebar.js'
import HelpModal from './components/HelpModal.js'

const App = ({ aosCore, processId, onClose }) => {
  const [messages, setMessages] = useState([])
  const [currentInput, setCurrentInput] = useState('')
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showHelp, setShowHelp] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [dryRunMode, setDryRunMode] = useState(false)
  const { exit } = useApp()

  // Add initial welcome message
  useEffect(() => {
    setMessages([{
      type: 'info',
      content: `Connected to AOS Process: ${processId}`,
      timestamp: new Date()
    }, {
      type: 'info', 
      content: 'Type "/" for help or Ctrl+C to exit',
      timestamp: new Date()
    }])
  }, [processId])

  // Handle keyboard input
  useInput((input, key) => {
    // Help modal open
    if (showHelp) {
      if (key.escape || (key.ctrl && input === 'c')) {
        setShowHelp(false)
      }
      return
    }

    // Global shortcuts
    if (key.ctrl && input === 'c') {
      if (aosCore) {
        aosCore.cleanup()
      }
      onClose()
      exit()
      return
    }

    // Toggle sidebar
    if (key.ctrl && input === 'b') {
      setShowSidebar(prev => !prev)
      return
    }

    // Help modal
    if (input === '/') {
      setShowHelp(true)
      return
    }

    // History navigation (up/down arrows)
    if (key.upArrow) {
      if (history.length > 0 && historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setCurrentInput(history[history.length - 1 - newIndex])
      }
      return
    }

    if (key.downArrow) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCurrentInput(history[history.length - 1 - newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setCurrentInput('')
      }
      return
    }

    // Clear history index when typing
    if (historyIndex !== -1 && input) {
      setHistoryIndex(-1)
    }
  })

  // Handle command submission
  const handleSubmit = useCallback(async (command) => {
    if (!command.trim()) return

    // Add command to messages
    const userMessage = {
      type: 'user',
      content: command,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    // Add to history
    setHistory(prev => [...prev.slice(-99), command])
    setHistoryIndex(-1)
    setCurrentInput('')

    try {
      // Handle dot commands first
      if (command.startsWith('.')) {
        const result = await aosCore.handleDotCommand(command)
        
        if (result) {
          if (result.type === 'exit') {
            aosCore.cleanup()
            onClose()
            exit()
            return
          }

          if (result.type === 'command') {
            // Execute the returned command
            const evalResult = await aosCore.evaluateCommand(result.command, { loadedModules: result.modules })
            handleEvaluationResult(evalResult)
          } else {
            // Handle other dot command results
            let responseMessage = result.message || result.content || 'Command executed'
            if (result.type === 'error') {
              responseMessage = `Error: ${responseMessage}`
            }
            setMessages(prev => [...prev, {
              type: result.type,
              content: responseMessage,
              timestamp: new Date()
            }])
          }

          // Handle dry run mode toggle
          if (result.type === 'info' && result.dryRunMode !== undefined) {
            setDryRunMode(result.dryRunMode)
          }
        }
      } else {
        // Regular Lua/shell command
        const result = await aosCore.evaluateCommand(command)
        handleEvaluationResult(result)
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'error',
        content: error.message,
        timestamp: new Date()
      }])
    }
  }, [aosCore, onClose, exit])

  // Handle evaluation results
  const handleEvaluationResult = (result) => {
    if (result.type === 'success') {
      setMessages(prev => [...prev, {
        type: 'output',
        content: result.output,
        timestamp: new Date()
      }])
    } else if (result.type === 'error') {
      let errorContent = result.message
      if (result.error && result.errorOrigin) {
        errorContent = `${result.message}\n  at ${result.errorOrigin.filename}:${result.errorOrigin.lineNumber}`
      }
      setMessages(prev => [...prev, {
        type: 'error',
        content: errorContent,
        timestamp: new Date()
      }])
    }
  }

  return React.createElement(Box, { flexDirection: "column", height: "100%" }, [
    React.createElement(Header, {
      key: "header",
      processId,
      dryRunMode,
      showSidebar,
      onToggleSidebar: () => setShowSidebar(!showSidebar)
    }),
    
    React.createElement(Box, { 
      key: "main", 
      flexGrow: 1, 
      flexDirection: "row" 
    }, [
      React.createElement(Box, { 
        key: "content",
        flexGrow: 1, 
        flexDirection: "column" 
      }, [
        React.createElement(Scrollback, { 
          key: "scrollback",
          messages 
        }),
        React.createElement(Input, { 
          key: "input",
          value: currentInput,
          onChange: setCurrentInput,
          onSubmit: handleSubmit,
          placeholder: aosCore?.prompt || 'aos> '
        })
      ]),

      showSidebar && React.createElement(Sidebar, {
        key: "sidebar",
        processId,
        dryRunMode,
        messageCount: messages.length
      })
    ]),

    showHelp && React.createElement(HelpModal, {
      key: "help",
      onClose: () => setShowHelp(false)
    })
  ])
}

export default App