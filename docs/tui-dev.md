# AOS Terminal UI Development Guide

## Overview

AOS now includes an optional Terminal User Interface (TUI) that provides a modern, interactive command-line experience with React/Ink components. The TUI is **completely optional** and does not affect existing CLI behavior.

## Running AOS

### Legacy CLI (Default)
```bash
# Standard interactive mode
aos

# Non-interactive execution
aos --run "print('Hello')"

# With specific process
aos my-process

# Legacy mode (explicit)
aos --legacy
```

### Terminal UI Mode
```bash
# Launch TUI with default process
aos tui

# Launch TUI with specific process ID or name
aos tui my-process

# Alternative flag syntax
aos --tui my-process
```

## TUI Features

### Layout
- **Header**: Process ID, connection status, and controls
- **Scrollback Pane**: Command history and output messages
- **Input Line**: Command input with auto-completion (future)
- **Sidebar**: Process info, quick commands, and shortcuts

### Keyboard Shortcuts

#### Global Shortcuts
- `/` - Open help modal
- `Ctrl+C` - Exit application
- `Ctrl+B` - Toggle sidebar visibility

#### Input Navigation
- `↑/↓` - Navigate command history
- `←/→` - Move cursor
- `Ctrl+A` - Beginning of line
- `Ctrl+E` - End of line
- `Backspace` - Delete character
- `Enter` - Submit command

#### Modal Controls
- `Esc` - Close modal (help, etc.)
- `q` - Close help modal

### Supported Commands

All standard AOS commands work in TUI mode:

#### Core Commands
- `.help` - Show help (same as pressing `/`)
- `.exit` - Exit TUI
- `.live` - Start live message feed
- `.pause` - Pause live message feed
- `.dryrun` - Toggle dry run mode

#### Monitoring
- `.monitor` - Monitor this process
- `.unmonitor` - Stop monitoring

#### File Operations
- `.load <file>` - Load a Lua file
- `.load-blueprint <name>` - Load a blueprint
- `.pad` - Open multi-line editor

#### System
- `.update` - Update AOS to latest version

## Development Architecture

### Core Module
The business logic has been extracted into `src/core/aos-core.js` which provides:

- Process management and connection
- Command evaluation
- Message handling
- History management
- Service abstraction

Both the legacy CLI and TUI use the same core module, ensuring consistent behavior.

### TUI Components
Located in `src/tui/components/`:

- `App.js` - Main application component
- `Header.js` - Status bar
- `Scrollback.js` - Message history display
- `Input.js` - Command input line
- `Sidebar.js` - Info panel
- `HelpModal.js` - Help overlay

### Lazy Loading
TUI components are only loaded when TUI mode is invoked, ensuring no impact on normal CLI startup performance.

## Connection Options

The TUI supports all existing AOS connection flags:

```bash
# Mainnet (default)
aos tui

# Custom endpoint
aos tui --url https://my-ao-node.com

# Testnet
aos tui --legacy

# Custom wallet
aos tui --wallet ~/.my-wallet.json

# With custom module
aos tui --module my-module-txid
```

## Building and Testing

### Build
```bash
# Standard build process (no changes needed)
npm run build
```

### Test TUI
```bash
# Launch TUI in development
node src/index.js tui

# Or use the built CLI
npm start -- tui
```

### Test Legacy Mode
```bash
# Ensure legacy mode still works
npm start

# Test --run mode
npm start -- --run "print('test')"
```

## Cross-Platform Considerations

### Windows
- Windows Terminal recommended for best experience
- Uses proper path handling in `bin/aos.js`
- All shortcuts should work as expected

### macOS/Linux
- Full terminal compatibility
- ANSI escape sequences handled properly by Ink

### CI/CD Environments
- TUI automatically detects non-interactive environments
- No UI pollution in automated scripts
- `--run` mode remains completely clean

## Troubleshooting

### TUI Won't Start
- Ensure terminal supports ANSI escape codes
- Check Node.js version (ESM modules required)
- Verify `ink` and `react` dependencies installed

### Performance Issues
- TUI uses lazy loading - startup time should match legacy mode
- Large message history may slow rendering - use Ctrl+B to hide sidebar
- Consider using legacy mode for automated scripts

### Display Issues
- Terminal width < 40 characters not supported
- Height < 10 lines may cause layout issues
- Some terminal emulators may have color/position quirks

## Future Enhancements

- Auto-completion for commands and files
- File browser sidebar
- Process monitoring dashboard
- Blueprint library integration
- Split pane layouts
- Theme customization

## Contributing

When modifying the TUI:

1. Keep components modular and focused
2. Ensure core logic stays in `aos-core.js`
3. Test both TUI and legacy modes
4. Follow existing React/Ink patterns
5. Maintain cross-platform compatibility