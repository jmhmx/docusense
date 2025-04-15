# Blockchain Integration

## Overview

DocuSense now includes blockchain integration for document verification and integrity tracking. This feature ensures that documents can be cryptographically verified against an immutable ledger, providing an additional layer of trust and transparency.

## Features

- Document registration on the blockchain
- Verification of document integrity
- Blockchain certificates for legal proof
- Integration with document signatures
- Tamper-evident history tracking

## Technical Implementation

The blockchain integration uses Hyperledger Fabric as the underlying distributed ledger technology. Smart contracts (chaincode) are implemented to handle document registration, verification, and certificate generation.

### Local Mode

For development and testing purposes, a local mode is available that simulates blockchain integration without requiring a full Hyperledger Fabric network. This mode is enabled by default in development environments.

### Configuration

The following environment variables can be used to configure the blockchain integration:

- `BLOCKCHAIN_CONNECTION_PROFILE`: Path to the connection profile JSON file (set to 'local' for local mode)
- `BLOCKCHAIN_CHANNEL`: Name of the channel to use (default: 'documentchannel')
- `BLOCKCHAIN_CHAINCODE`: Name of the chaincode to use (default: 'documentcc')
- `BLOCKCHAIN_WALLET_PATH`: Path to the wallet directory (default: './wallet')
- `BLOCKCHAIN_ORG_MSPID`: MSP ID of the organization (default: 'Org1MSP')

## Usage

### Register a Document

Documents are automatically registered on the blockchain when they are created in the system.

### Verify Document Integrity

Use the blockchain verification tab in the document viewer to verify the integrity of a document against the blockchain.

### Get a Verification Certificate

You can obtain a blockchain verification certificate to prove that a document has been registered and has not been tampered with.
