/**
 * AOS Core Module
 * 
 * UI-agnostic business logic for AOS process management.
 * This module contains the core functionality that can be used by both
 * the legacy CLI REPL and the new TUI interface.
 */

import { evaluate } from '../evaluate.js'
import { register } from '../register.js'
import { dryEval } from '../dry-eval.js'
import { getWallet, getWalletFromArgs } from '../services/wallets.js'
import { address, isAddress } from '../services/address.js'
import * as connectSvc from '../services/connect.js'
import * as mainnetSvc from '../services/mainnet.js'
import { gql } from '../services/gql.js'
import { checkForUpdate, installUpdate } from '../services/version.js'
import { getErrorOrigin, outputError, parseError } from '../services/errors.js'
import { getPkg } from '../services/get-pkg.js'
import { monitor } from '../commands/monitor.js'
import { unmonitor } from '../commands/unmonitor.js'
import { load } from '../commands/load.js'
import { loadBlueprint } from '../commands/blueprints.js'
import { replHelp } from '../services/help.js'
import { list } from '../services/list.js'
import * as osCommand from '../commands/os.js'
import { readHistory, writeHistory } from '../services/history-service.js'
import { pad } from '../commands/pad.js'
import { config } from '../config.js'
import { printWithFormat } from '../utils/print.js'
import { chalk } from '../utils/colors.js'
import ora from 'ora'

export class AosCore {
  constructor() {
    this.isInitialized = false
    this.processId = null
    this.wallet = null
    this.services = {}
    this.variant = null
    this.isLegacyMode = false
    this.prompt = 'aos> '
    this.history = []
    this.dryRunMode = false
    this.liveMonitor = null
  }

  /**
   * Initialize the AOS core with the given configuration
   */
  async initialize(options = {}) {
    const { argv = {}, walletFile = null } = options

    // Set up services based on mode (mainnet vs legacy)
    await this.setupServices(argv)
    
    // Get wallet
    this.wallet = walletFile ? 
      await getWalletFromArgs(walletFile) : 
      await getWallet()

    // Register or connect to process
    await this.registerProcess(argv)

    // Load history if process ID exists
    if (this.processId) {
      this.history = readHistory(this.processId)
    }

    this.isInitialized = true
    return this.getProcessInfo()
  }

  /**
   * Set up services based on connection mode
   */
  async setupServices(argv) {
    // Default to mainnet mode unless legacy flag is used
    if (!argv['legacy']) {
      try {
        process.env.AO_URL = argv['url'] || config.urls.DEFAULT_HB_NODE
        process.env.SCHEDULER = process.env.SCHEDULER ?? config.addresses.SCHEDULER_MAINNET

        this.services = {
          sendMessage: mainnetSvc.sendMessageMainnet,
          spawnProcess: mainnetSvc.spawnProcessMainnet,
          readResult: mainnetSvc.readResultMainnet,
          live: mainnetSvc.liveMainnet,
          printLive: mainnetSvc.printLiveMainnet,
          dryrun: () => null,
          monitorProcess: mainnetSvc.monitorProcessMainnet,
          unmonitorProcess: mainnetSvc.unmonitorProcessMainnet
        }
      } catch (e) {
        throw new Error(`Error connecting to ${argv['url'] || config.urls.DEFAULT_HB_NODE}: ${e.message}`)
      }
    } else {
      // Legacy mode
      this.services = {
        sendMessage: connectSvc.sendMessage,
        spawnProcess: connectSvc.spawnProcess,
        readResult: connectSvc.readResult,
        live: connectSvc.live,
        printLive: connectSvc.printLive,
        dryrun: connectSvc.dryrun,
        monitorProcess: connectSvc.monitorProcess,
        unmonitorProcess: connectSvc.unmonitorProcess
      }
    }
  }

  /**
   * Register or connect to an AOS process
   */
  async registerProcess(argv) {
    const { id, variant } = await register(this.wallet, {
      address,
      isAddress,
      spawnProcess: this.services.spawnProcess,
      gql,
      spawnProcessMainnet: mainnetSvc.spawnProcessMainnet
    })

    this.processId = id
    this.variant = variant

    // Handle testnet variant
    if (variant === 'ao.TN.1') {
      this.services = {
        sendMessage: connectSvc.sendMessage,
        spawnProcess: connectSvc.spawnProcess,
        readResult: connectSvc.readResult,
        live: connectSvc.live,
        printLive: connectSvc.printLive,
        dryrun: connectSvc.dryrun,
        monitorProcess: connectSvc.monitorProcess,
        unmonitorProcess: connectSvc.unmonitorProcess
      }
      process.env.AO_URL = 'undefined'
      this.isLegacyMode = true
    }

    if (!this.processId) {
      throw new Error('Could not find process ID.')
    }
  }

  /**
   * Get current process information
   */
  getProcessInfo() {
    return {
      processId: this.processId,
      variant: this.variant,
      isLegacyMode: this.isLegacyMode,
      prompt: this.prompt,
      walletAddress: this.wallet ? address(this.wallet) : null
    }
  }

  /**
   * Connect to the process and get the prompt
   */
  async connect() {
    if (!this.isInitialized) {
      throw new Error('AosCore must be initialized before connecting')
    }

    const spinner = ora({
      spinner: 'dots',
      suffixText: ''
    })

    spinner.start()
    spinner.suffixText = chalk.gray('[Connecting To Process...]')

    let promptResult = undefined
    let _prompt = undefined

    // Try to get prompt from process
    promptResult = await evaluate(
      `require('.process')._version`,
      this.processId,
      this.wallet,
      { sendMessage: this.services.sendMessage, readResult: this.services.readResult },
      spinner,
      true
    )

    _prompt = promptResult?.Output?.prompt || promptResult?.Output?.data?.prompt

    // Retry if prompt is undefined
    for (let i = 0; i < 50; i++) {
      if (_prompt === undefined) {
        if (i === 0) {
          spinner.suffixText = chalk.gray('[Connecting To Process...]')
        } else {
          spinner.suffixText = chalk.red('[Connecting To Process...]')
        }

        promptResult = await evaluate(
          `require('.process')._version`,
          this.processId,
          this.wallet,
          { sendMessage: this.services.sendMessage, readResult: this.services.readResult },
          spinner
        )

        _prompt = promptResult?.Output?.prompt || promptResult?.Output?.data?.prompt
      } else {
        break
      }
    }

    spinner.stop()

    if (_prompt === undefined) {
      throw new Error('Could not connect to process!')
    }

    // Check for version mismatch
    const aosVersion = getPkg().aos.version
    if (promptResult.Output.data?.output !== aosVersion && promptResult.Output.data !== aosVersion) {
      if (promptResult.Output.data !== 'dev') {
        // Note: TUI should handle this notification
        console.log('A new AOS update is available. run [.update] to install.')
      }
    }

    this.prompt = _prompt
    return _prompt
  }

  /**
   * Start live monitoring
   */
  async startLiveMonitor() {
    if (!this.isInitialized) {
      throw new Error('AosCore must be initialized before starting live monitor')
    }

    this.liveMonitor = await this.services.live(this.processId)
    if (this.liveMonitor) {
      this.liveMonitor.start()
    }
    return this.liveMonitor
  }

  /**
   * Stop live monitoring
   */
  stopLiveMonitor() {
    if (this.liveMonitor) {
      this.liveMonitor.stop()
    }
  }

  /**
   * Evaluate a command and return the result
   */
  async evaluateCommand(command, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AosCore must be initialized before evaluating commands')
    }

    const { 
      spinner = null, 
      loadedModules = [], 
      dryRun = this.dryRunMode,
      swallowError = false 
    } = options

    let evaluator

    if (dryRun) {
      evaluator = () => dryEval(command, this.processId, this.wallet, { dryrun: this.services.dryrun }, spinner)
    } else {
      evaluator = () => evaluate(command, this.processId, this.wallet, { 
        sendMessage: this.services.sendMessage, 
        readResult: this.services.readResult 
      }, spinner)
    }

    const result = await evaluator().catch(err => {
      if (swallowError) return { Error: err.message }
      throw err
    })

    return this.handleEvaluationResult(result, command, loadedModules)
  }

  /**
   * Handle evaluation result and return formatted output
   */
  handleEvaluationResult(result, command, loadedModules = []) {
    const output = result?.Output
    const errorPayload = result?.Error || result?.error

    if (errorPayload) {
      const error = parseError(errorPayload)
      if (error) {
        const errorOrigin = getErrorOrigin(loadedModules, error.lineNumber)
        return {
          type: 'error',
          error,
          errorOrigin,
          message: errorPayload
        }
      } else {
        return {
          type: 'error',
          message: errorPayload
        }
      }
    }

    if (output?.data) {
      let response = {}

      if (Object.prototype.hasOwnProperty.call(output.data, 'output')) {
        response.output = output.data.output
      } else if (Object.prototype.hasOwnProperty.call(output.data, 'prompt')) {
        response.output = ''
      } else {
        response.output = output.data
      }

      const nextPrompt = Object.prototype.hasOwnProperty.call(output.data, 'prompt')
        ? output.data.prompt
        : output.prompt

      if (nextPrompt) {
        this.prompt = nextPrompt
        response.prompt = nextPrompt
      }

      return {
        type: 'success',
        ...response
      }
    }

    if (!output) {
      return {
        type: 'error',
        message: 'An unknown error occurred.'
      }
    }

    if (typeof output === 'string') {
      return {
        type: 'success',
        output
      }
    }

    return {
      type: 'success',
      output
    }
  }

  /**
   * Handle dot commands (.help, .live, .pause, etc.)
   */
  async handleDotCommand(command) {
    const trimCommand = command.trim()

    switch (trimCommand) {
      case '.help':
        return {
          type: 'help',
          content: replHelp()
        }

      case '.live':
        this.startLiveMonitor()
        return {
          type: 'info',
          message: '=== Starting Live Feed ==='
        }

      case '.pause':
        this.stopLiveMonitor()
        return {
          type: 'info',
          message: '=== Pausing Live Feed ==='
        }

      case '.dryrun':
        this.dryRunMode = !this.dryRunMode
        return {
          type: 'info',
          message: this.dryRunMode ? 'Dryrun Mode Engaged' : 'Dryrun Mode Disengaged',
          dryRunMode: this.dryRunMode
        }

      case '.monitor':
        try {
          const result = await monitor(this.wallet, this.processId, { 
            monitorProcess: this.services.monitorProcess 
          })
          return {
            type: 'success',
            message: result
          }
        } catch (_) {
          return {
            type: 'error',
            message: 'Could not monitor process!'
          }
        }

      case '.unmonitor':
        try {
          const result = await unmonitor(this.wallet, this.processId, { 
            unmonitorProcess: this.services.unmonitorProcess 
          })
          return {
            type: 'success',
            message: result
          }
        } catch (_) {
          return {
            type: 'error',
            message: 'Monitor not found!'
          }
        }

      case '.update':
        return {
          type: 'command',
          command: osCommand.update()
        }

      case '.exit':
        return {
          type: 'exit'
        }

      default:
        // Handle .load and .load-blueprint commands
        if (/^\.load-blueprint/.test(trimCommand)) {
          try {
            const newCommand = loadBlueprint(trimCommand)
            return {
              type: 'command',
              command: newCommand
            }
          } catch (e) {
            return {
              type: 'error',
              message: e.message
            }
          }
        }

        if (/^\.load/.test(trimCommand)) {
          try {
            const [line, loadedModules] = load(trimCommand)
            return {
              type: 'load',
              command: line,
              modules: loadedModules
            }
          } catch (e) {
            return {
              type: 'error',
              message: e.message
            }
          }
        }

        return null
    }
  }

  /**
   * Save history to file
   */
  saveHistory() {
    if (this.processId && this.history.length > 0) {
      writeHistory(this.processId, this.history)
    }
  }

  /**
   * Add command to history
   */
  addToHistory(command) {
    this.history.push(command)
    // Keep history size manageable
    if (this.history.length > 100) {
      this.history = this.history.slice(-100)
    }
  }

  /**
   * Get history
   */
  getHistory() {
    return [...this.history]
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopLiveMonitor()
    this.saveHistory()
  }
}

export default AosCore