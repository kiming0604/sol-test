export interface Counter {
  count: number;
  authority: string;
}

export interface CounterProgram {
  initialize: (authority: string) => Promise<string>;
  increment: (counterAddress: string) => Promise<string>;
  decrement: (counterAddress: string) => Promise<string>;
  reset: (counterAddress: string) => Promise<string>;
  getCounter: (counterAddress: string) => Promise<Counter>;
}

// 컨트랙트 주소 (실제 배포 시 변경됨)
export const COUNTER_PROGRAM_ID = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS";

// 컨트랙트 ABI (실제 배포 시 생성됨)
export const COUNTER_ABI = {
  "version": "0.1.0",
  "name": "counter",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "counter",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "increment",
      "accounts": [
        {
          "name": "counter",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": []
    },
    {
      "name": "decrement",
      "accounts": [
        {
          "name": "counter",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": []
    },
    {
      "name": "reset",
      "accounts": [
        {
          "name": "counter",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": []
    }
  ]
};
