# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cline is a VS Code extension that provides an autonomous AI coding assistant. The project consists of:
- **Extension backend** (`src/`): TypeScript code for the VS Code extension
- **Webview UI** (`webview-ui/`): React-based UI for the chat interface
- **Documentation** (`docs/`): Next.js documentation site
- **Evaluations** (`evals/`): Testing and evaluation framework

## Development Commands

### Core Development
- `npm run compile` - Build extension (includes type checking and linting)
- `npm run watch` - Watch mode for development (runs esbuild and tsc in parallel)
- `npm run package` - Production build with webview
- `npm run lint` - Lint both extension and webview code
- `npm run check-types` - Type check extension and webview
- `npm run format:fix` - Format code with Prettier

### Testing
- `npm run test` - Run all tests (unit + integration)
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run VS Code integration tests
- `npm run test:e2e` - Run end-to-end tests with Playwright
- `npm run test:coverage` - Run tests with coverage

### Webview Development
- `npm run dev:webview` - Start webview development server
- `npm run build:webview` - Build webview for production
- `npm run test:webview` - Run webview unit tests

### Specialized Commands
- `npm run protos` - Generate protobuf definitions and gRPC clients
- `npm run compile-standalone` - Build standalone version
- `npm run e2e` - Run E2E tests (requires extension packaging)

## Architecture Overview

### Core Components
- **Controller** (`src/core/controller/`): Main orchestrator handling UI events and state management
- **Task Engine** (`src/core/task/`): Manages AI conversations and tool execution
- **Tools** (`src/core/tools/`): Individual tools (bash, edit, read, etc.) that Cline can use
- **API Layer** (`src/api/`): Handles communication with various AI providers
- **Context Management** (`src/core/context/`): Manages conversation context and memory
- **Host Bridge** (`src/hosts/`): Abstraction layer for VS Code integration

### Key Architectural Patterns
- **gRPC Communication**: Extension backend and webview communicate via gRPC
- **Protobuf Schemas**: All inter-component communication uses protobuf definitions (`proto/`)
- **MCP Integration**: Model Context Protocol support for extending capabilities
- **Tool System**: Modular tool architecture for extensible AI capabilities

### Data Flow
1. User interacts with React webview UI
2. UI sends gRPC messages to extension controller
3. Controller orchestrates tasks using the Task engine
4. Task engine uses tools and API providers to execute actions
5. Results flow back through the same path to update UI

### Important Files
- `src/extension.ts` - Extension entry point and VS Code integration
- `src/core/controller/index.ts` - Main controller class
- `src/core/task/index.ts` - Task execution engine
- `webview-ui/src/App.tsx` - Main React application
- `src/core/tools/` - Individual tool implementations

## Development Workflow

1. **Setup**: Run `npm run install:all` to install all dependencies
2. **Development**: Use `npm run watch` for extension development
3. **Webview**: Use `npm run dev:webview` for UI development
4. **Testing**: Run `npm run test` before committing
5. **Linting**: Code is auto-formatted on commit via husky hooks

## Key Dependencies

- **VS Code API**: Core extension functionality
- **Anthropic SDK**: Claude AI integration
- **gRPC**: Inter-component communication
- **Protobuf**: Message serialization
- **React**: Webview UI framework
- **Playwright**: E2E testing
- **Tree-sitter**: Code parsing and analysis

## Rate Limiting & Cost Management

Cline includes comprehensive rate limiting and cost management features to help users control API usage and prevent unexpected costs:

### Features
- **Request Rate Limiting**: Configurable requests per minute limits
- **Cost Budgeting**: Session and daily spending limits
- **Real-time Monitoring**: Live cost and usage tracking in the UI
- **Smart Alerts**: Warnings at configurable thresholds
- **Provider-agnostic**: Works with all supported AI providers

### Implementation
- **RateLimitService** (`src/services/rate-limiting/`): Core rate limiting logic
- **CostAlertService** (`src/services/notifications/`): User notifications
- **RateLimitedApiHandler** (`src/api/`): API wrapper with rate limiting
- **Rate Limiting Settings**: Available in Settings > Rate Limiting tab

### Configuration
Rate limiting settings are stored in the extension's global state and include:
- `rateLimitEnabled`: Master enable/disable toggle
- `rateLimitRequestsPerMinute`: Maximum API requests per minute
- `rateLimitDelayBetweenRequests`: Minimum delay between requests (ms)
- `rateLimitMaxCostPerSession`: Maximum cost per coding session ($)
- `rateLimitMaxCostPerDay`: Maximum cost per day ($)
- `rateLimitWarningThreshold`: Warning threshold percentage (0-100)