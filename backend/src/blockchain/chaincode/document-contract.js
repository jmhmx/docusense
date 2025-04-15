'use strict';

const { Contract } = require('fabric-contract-api');

class DocumentContract extends Contract {
  async InitLedger(ctx) {
    console.log('Document smart contract initialized');
    return { status: 'ok', message: 'Document smart contract initialized' };
  }

  async RegisterDocument(ctx, documentId, documentData) {
    console.log(`RegisterDocument: document ${documentId}`);

    // Check if document already exists
    const exists = await this.DocumentExists(ctx, documentId);
    if (exists) {
      throw new Error(`Document ${documentId} already exists`);
    }

    // Store the document data in the ledger
    await ctx.stub.putState(documentId, Buffer.from(documentData));

    // Emit an event for the registration
    ctx.stub.setEvent(
      'DocumentRegistered',
      Buffer.from(
        JSON.stringify({
          documentId,
          timestamp: new Date().toISOString(),
        }),
      ),
    );

    return { status: 'ok', documentId };
  }

  async GetDocument(ctx, documentId) {
    const documentBytes = await ctx.stub.getState(documentId);
    if (!documentBytes || documentBytes.length === 0) {
      throw new Error(`Document ${documentId} does not exist`);
    }
    return documentBytes.toString();
  }

  async DocumentExists(ctx, documentId) {
    const documentBytes = await ctx.stub.getState(documentId);
    return documentBytes && documentBytes.length > 0;
  }

  async UpdateDocument(ctx, documentId, documentData) {
    console.log(`UpdateDocument: document ${documentId}`);

    // Check if document exists
    const exists = await this.DocumentExists(ctx, documentId);
    if (!exists) {
      throw new Error(`Document ${documentId} does not exist`);
    }

    // Update the document data in the ledger
    await ctx.stub.putState(documentId, Buffer.from(documentData));

    // Emit an event for the update
    ctx.stub.setEvent(
      'DocumentUpdated',
      Buffer.from(
        JSON.stringify({
          documentId,
          timestamp: new Date().toISOString(),
        }),
      ),
    );

    return { status: 'ok', documentId };
  }

  async GetDocumentHistory(ctx, documentId) {
    console.log(`GetDocumentHistory: document ${documentId}`);

    // Check if document exists
    const exists = await this.DocumentExists(ctx, documentId);
    if (!exists) {
      throw new Error(`Document ${documentId} does not exist`);
    }

    const iterator = await ctx.stub.getHistoryForKey(documentId);
    const history = [];

    let result = await iterator.next();
    while (!result.done) {
      const responseJson = {};
      responseJson.txId = result.value.txId;
      responseJson.timestamp = new Date(
        result.value.timestamp.seconds.low * 1000,
      );
      responseJson.isDelete = result.value.isDelete;

      try {
        responseJson.value = JSON.parse(result.value.value.toString('utf8'));
      } catch (err) {
        responseJson.value = result.value.value.toString('utf8');
      }

      history.push(responseJson);
      result = await iterator.next();
    }
    await iterator.close();

    return JSON.stringify(history);
  }

  async GetDocumentCertificate(ctx, documentId) {
    console.log(`GetDocumentCertificate: document ${documentId}`);

    // Check if document exists
    const exists = await this.DocumentExists(ctx, documentId);
    if (!exists) {
      throw new Error(`Document ${documentId} does not exist`);
    }

    // Get the document data
    const documentBytes = await ctx.stub.getState(documentId);
    const documentData = JSON.parse(documentBytes.toString());

    // Get transaction information
    const txId = ctx.stub.getTxID();

    // Get the block height information
    const blockInfo = await ctx.stub.getBlockByTxID(txId);
    const blockHeight = blockInfo ? blockInfo.header.number : 0;

    // Create certificate
    const certificate = {
      documentId,
      transactionId: txId,
      timestamp: new Date().toISOString(),
      registeredBy: documentData.metadata.owner,
      documentHash: documentData.documentHash,
      blockHeight,
      certificateId: ctx.stub
        .createCompositeKey('DocCert', [documentId, txId])
        .toString(),
    };

    return JSON.stringify(certificate);
  }
}

module.exports = DocumentContract;
