/**
 * Help Modal Component
 * 
 * Displays help overlay with command reference
 */

import React from 'react'
import { Box, Text, useInput } from 'ink'

const HelpModal = ({ onClose }) => {

  // Handle keyboard input to close modal
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c') || input === 'q') {
      onClose()
    }
  })

  // Fixed modal dimensions for simplicity
  const modalWidth = 76
  const modalHeight = 36

  const commands = [
    { category: 'Core Commands', commands: [
      { cmd: '.help', desc: 'Show this help message' },
      { cmd: '.exit', desc: 'Exit the application' },
      { cmd: '.live', desc: 'Start live message feed' },
      { cmd: '.pause', desc: 'Pause live message feed' },
      { cmd: '.dryrun', desc: 'Toggle dry run mode' },
    ]},
    { category: 'Monitoring', commands: [
      { cmd: '.monitor', desc: 'Monitor this process' },
      { cmd: '.unmonitor', desc: 'Stop monitoring process' },
    ]},
    { category: 'File Operations', commands: [
      { cmd: '.load <file>', desc: 'Load a Lua file' },
      { cmd: '.load-blueprint <name>', desc: 'Load a blueprint' },
      { cmd: '.pad', desc: 'Open pad for multi-line input' },
    ]},
    { category: 'System', commands: [
      { cmd: '.update', desc: 'Update AOS to latest version' },
    ]},
  ]

  const shortcuts = [
    { key: '/', desc: 'Open this help modal' },
    { key: '↑/↓', desc: 'Navigate command history' },
    { key: 'Ctrl+C', desc: 'Exit application' },
    { key: 'Ctrl+B', desc: 'Toggle sidebar' },
    { key: 'Ctrl+A', desc: 'Move to beginning of line' },
    { key: 'Ctrl+E', desc: 'Move to end of line' },
    { key: 'Esc', desc: 'Close modal' },
    { key: 'q', desc: 'Close modal (from help)' },
  ]

  return React.createElement(Box, {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black"
  }, [
    React.createElement(Box, {
      width: modalWidth,
      height: modalHeight,
      flexDirection: "column",
      borderStyle: "double",
      borderColor: "yellow",
      paddingX: 1,
      backgroundColor: "black"
    }, [
      React.createElement(Box, {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 1
      }, [
        React.createElement(Text, {
          bold: true,
          color: "yellow",
          backgroundColor: "black"
        }, "AOS Terminal UI - Help")
      ]),

      React.createElement(Box, {
        flexDirection: "column",
        flexGrow: 1
      }, [
        commands.map((section, sectionIndex) => 
          React.createElement(Box, {
            key: sectionIndex,
            flexDirection: "column",
            marginBottom: 1
          }, [
            React.createElement(Text, {
              bold: true,
              color: "cyan"
            }, section.category),
            section.commands.map((command, cmdIndex) =>
              React.createElement(Box, {
                key: cmdIndex,
                flexDirection: "row",
                marginLeft: 2
              }, [
                React.createElement(Text, {
                  color: "green",
                  width: 20
                }, command.cmd),
                React.createElement(Text, {
                  color: "white"
                }, command.desc)
              ])
            )
          ])
        ),

        React.createElement(Box, {
          flexDirection: "column",
          marginTop: 1
        }, [
          React.createElement(Text, {
            bold: true,
            color: "cyan"
          }, "Keyboard Shortcuts"),
          shortcuts.map((shortcut, index) =>
            React.createElement(Box, {
              key: index,
              flexDirection: "row",
              marginLeft: 2
            }, [
              React.createElement(Text, {
                color: "yellow",
                width: 12
              }, shortcut.key),
              React.createElement(Text, {
                color: "white"
              }, shortcut.desc)
            ])
          )
        ])
      ]),

      React.createElement(Box, {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 1
      }, [
        React.createElement(Text, {
          dimColor: true
        }, "Press [Esc], [q], or [Ctrl+C] to close")
      ])
    ])
  ])
}

export default HelpModal