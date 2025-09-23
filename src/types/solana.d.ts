declare module '@solana/web3.js' {
  export class Connection {
    constructor(endpoint: string);
    getLatestBlockhash(): Promise<{ blockhash: string }>;
  }
  export class PublicKey {
    constructor(publicKey: string);
    toString(): string;
  }
  export class Transaction {
    constructor();
    add(instruction: any): Transaction;
    serialize(): Uint8Array;
    recentBlockhash: string;
    feePayer: PublicKey;
  }
  export class SystemProgram {
    static transfer(params: any): any;
  }
}

declare module '@solana/spl-token' {
  export function createTransferInstruction(
    fromPubkey: any,
    toPubkey: any,
    owner: any,
    amount: number
  ): any;
  export function getAssociatedTokenAddress(
    mint: any,
    owner: any
  ): Promise<any>;
}
