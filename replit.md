# MegaETH Bridge

## Overview

A cryptocurrency bridge application that enables users to transfer ETH between Base (L2) and MegaETH networks. The platform provides a React frontend with wallet integration via Privy, an Express backend API, and PostgreSQL database for transaction tracking. Users connect their wallets, get bridge quotes with fee calculations, and execute cross-chain transfers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom plugins for meta images and Replit integration
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom theme variables for brand colors (mega-green, mega-purple)
- **Wallet Integration**: Privy SDK for multi-wallet support (MetaMask, Coinbase, Rainbow, etc.)
- **Animations**: Framer Motion

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **Build**: esbuild for production bundling with selective dependency bundling
- **API Design**: RESTful endpoints under `/api` prefix
- **Static Serving**: Express serves built frontend assets in production

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` for shared types between frontend and backend
- **Tables**:
  - `users`: Basic user authentication (id, username, password)
  - `bridge_transactions`: Transaction tracking (txHash, depositor, amount, status, chain IDs, timestamps)
- **Migrations**: Drizzle Kit with `db:push` command

### Smart Contract Integration
- **Deposit Contract**: Deployed on Base mainnet for receiving bridge deposits
- **Contract Address**: Defined in `client/src/lib/contract.ts`
- **Chain Configuration**: Custom chain definitions for MegaETH (chain ID 4326) and Base (chain ID 8453)

### Key Design Patterns
- **Shared Types**: Common schema and types in `shared/` directory accessible by both client and server
- **Path Aliases**: `@/` for client source, `@shared/` for shared code
- **Storage Interface**: Abstract storage layer (`IStorage`) with database implementation for flexibility
- **Quote System**: Server-side bridge quote calculation with slippage and fee breakdown

## External Dependencies

### Authentication & Wallet
- **Privy**: Web3 authentication SDK (`@privy-io/react-auth`) - requires `PRIVY_APP_ID` environment variable

### Database
- **PostgreSQL**: Primary database - requires `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries
- **connect-pg-simple**: Session storage

### Blockchain
- **viem**: Ethereum library for chain definitions and wallet interactions
- **Custom RPC Endpoints**: 
  - MegaETH: `https://rpc-secret-mega.poptyedev.com/`
  - Base: `https://mainnet.base.org`

### UI Framework
- **Radix UI**: Full suite of accessible primitives (dialog, dropdown, popover, tabs, etc.)
- **shadcn/ui**: Pre-built component patterns
- **Lucide React**: Icon library

### Build & Development
- **Vite**: Frontend build with React plugin and Tailwind CSS
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development