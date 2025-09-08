# Contributing to workflows-ts

Thank you for your interest in contributing to workflows-ts! This guide will help you get started with contributing to our event-driven workflow engine.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **pnpm**: Version 10.15.0 (managed by packageManager field)
- **Git**: For version control

### Initial Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/workflows-ts.git
   cd workflows-ts
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Build all packages**

   ```bash
   pnpm run build
   ```

4. **Run tests to verify setup**
   ```bash
   pnpm run test
   ```

## Development Workflow

### Project Structure

This is a monorepo with the following key packages:

- **`packages/core/`**: Core workflow engine (`@llamaindex/workflow-core`)
- **`packages/http/`**: HTTP protocol adapter (`@llamaindex/workflow-http`)
- **`packages/llamaindex/`**: LlamaIndex integration
- **`demo/`**: Example implementations and integrations
- **`tests/cjs/`**: CommonJS compatibility tests

### Common Development Commands

#### Monorepo-wide Commands

```bash
# Build all packages
pnpm run build

# Type check across all packages
pnpm run typecheck

# Run all tests
pnpm run test

# Check code formatting
pnpm run format

# Auto-format code
pnpm run format:write

# Check linting
pnpm run lint

# Auto-lint code (might still leave linting problems)
pnpm run lint:fix
```

#### Package-specific Development

```bash
# Core package development
cd packages/core
pnpm run build    # Build the core package
pnpm run dev      # Watch mode for development
pnpm run test     # Run core package tests
pnpm run lint     # Lint
pnpm run lint:fix # Lint and auto-fix errors

# HTTP package development
cd packages/http
pnpm run build    # Build with Bunchee
pnpm run dev      # Watch mode with Bunchee
```

### Making Changes

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style and patterns
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**

   ```bash
   pnpm run test           # Run all tests
   pnpm run typecheck      # Check TypeScript types
   pnpm run format         # Verify formatting
   pnpm run lint           # Verify linting
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   We use Husky for pre-commit hooks that will automatically format your code and run checks.

## Code Style and Standards

### Formatting

- We use **Biome** for code formatting
- Formatting is automatically applied on commit via lint-staged
- Run `pnpm run format:write` to format files manually

### Linting

- We use **Biome** for linting
- Running `pnpm run lint:fix` is a way of auto-linting the code, but it might leave untracked errors

### TypeScript

- All code should be written in TypeScript
- Ensure `pnpm run typecheck` passes before submitting
- Follow existing type patterns and naming conventions

### Testing

- **Test framework**: Vitest
- **Browser testing**: Uses `happy-dom` environment
- **Test location**: Tests should be colocated with source files (`.test.ts`)
- Write tests for new features and bug fixes
- Maintain or improve test coverage

## Submitting Changes

### Pull Request Process

1. **Push your branch**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request**
   - Use a descriptive title and description
   - Reference any related issues
   - Ensure all CI checks pass

3. **Address feedback**
   - Respond to code review comments
   - Make requested changes
   - Push updates to your branch

### Commit Message Format

We follow conventional commit format:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding or updating tests
- `chore:` maintenance tasks

### Changeset Process

For changes that affect published packages:

1. **Create a changeset**

   ```bash
   npx changeset
   ```

2. **Follow the prompts** to describe your changes and select affected packages

3. **Commit the changeset file** along with your changes

## Release Process

**Maintainers only**

Releases are managed through Changesets:

- Maintainers will run `pnpm run publish` to create releases
- Version bumps are determined by changeset files
- Packages are independently versioned and published

## Getting Help

- **Issues**: Check existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions
- **Documentation** can be found at https://ts.llamaindex.ai/docs/workflows

---

Thank you for contributing to workflows-ts! 🚀
