/**
 * TUI Runner
 * 
 * Entry point for the Terminal UI mode
 * Bootstraps React/Ink application with AOS core
 */

import React from 'react'
import { render } from 'ink'
import AosCore from '../core/aos-core.js'
import App from './App.js'

/**
 * Run the AOS Terminal UI
 * @param {Object} options - Configuration options
 * @param {string} options.processId - Optional process ID to connect to
 * @param {Object} options.argv - CLI arguments
 * @param {string} options.walletFile - Optional wallet file path
 */
async function runTui(options = {}) {
  const { processId: providedProcessId, argv = {}, walletFile } = options

  try {
    // Initialize AOS Core
    const aosCore = new AosCore()
    await aosCore.initialize({ argv, walletFile })

    // Connect to process
    await aosCore.connect()

    // Get process info
    const processInfo = aosCore.getProcessInfo()
    const processId = providedProcessId || processInfo.processId

    // Start live monitoring
    await aosCore.startLiveMonitor()

    // Setup cleanup on exit
    const cleanup = () => {
      aosCore.cleanup()
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    // Render the React app
    const instance = render(
      React.createElement(App, {
        aosCore,
        processId,
        onClose: cleanup
      })
    )

    // Wait for the app to exit (this will never resolve normally)
    return new Promise(() => {}) // Keep the process running

  } catch (error) {
    console.error('Failed to start TUI:', error.message)
    process.exit(1)
  }
}

export default runTui