/**
 * Input Component
 * 
 * Command input line with history and auto-completion
 */

import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, useInput } from 'ink'

const Input = ({ value, onChange, onSubmit, placeholder = 'aos> ' }) => {
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef(null)

  // Handle keyboard input
  useInput((input, key) => {
    if (isComposing) return

    // Handle backspace
    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newValue = 
          value.slice(0, cursorPosition - 1) + 
          value.slice(cursorPosition)
        onChange(newValue)
        setCursorPosition(Math.max(0, cursorPosition - 1))
      }
      return
    }

    // Handle cursor movement
    if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1))
      return
    }

    if (key.rightArrow) {
      setCursorPosition(Math.min(value.length, cursorPosition + 1))
      return
    }

    // Handle home/end
    if (key.ctrl && input === 'a') {
      setCursorPosition(0)
      return
    }

    if (key.ctrl && input === 'e') {
      setCursorPosition(value.length)
      return
    }

    // Handle enter for submission
    if (key.return) {
      if (value.trim()) {
        onSubmit(value)
        onChange('')
        setCursorPosition(0)
      }
      return
    }

    // Handle tab completion (stub for now)
    if (key.tab) {
      // Future: implement auto-completion
      return
    }

    // Handle regular input
    if (input) {
      const newValue = 
        value.slice(0, cursorPosition) + 
        input + 
        value.slice(cursorPosition)
      onChange(newValue)
      setCursorPosition(cursorPosition + 1)
    }
  })

  // Update cursor position when value changes externally
  useEffect(() => {
    if (cursorPosition > value.length) {
      setCursorPosition(value.length)
    }
  }, [value, cursorPosition])

  // Render input with cursor
  const renderInput = () => {
    const beforeCursor = value.slice(0, cursorPosition)
    const afterCursor = value.slice(cursorPosition)
    
    return React.createElement(Box, null, [
      React.createElement(Text, { color: "cyan" }, placeholder),
      React.createElement(Text, { color: "white" }, beforeCursor),
      React.createElement(Text, { inverse: true }, " "),
      React.createElement(Text, { color: "white" }, afterCursor)
    ])
  }

  return React.createElement(Box, {
    borderStyle: "single",
    borderColor: "cyan",
    paddingX: 1,
    flexDirection: "row",
    alignItems: "center"
  }, [renderInput()])
}

export default Input