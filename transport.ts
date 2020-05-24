import { connectWebSocket, isWebSocketCloseEvent } from "./deps.ts";

export interface Command {
  id: number;
  method: string;
  params?: object;
}

export interface IncommingMessage {
  id: number;
  method: string;
  error?: string;
  params: object;
}

export interface Transport {
  send(command: Command): Promise<void>;
  close(): Promise<void>;
  receive(): Promise<IncommingMessage>;
  isClosed(): boolean;
}

export async function createWSTransport(url: string): Promise<Transport> {
  const ws = await connectWebSocket(url);
  const iter = ws[Symbol.asyncIterator]();

  function send(command: Command): Promise<void> {
    return ws.send(JSON.stringify(command));
  }

  async function close(): Promise<void> {
    if (!ws.isClosed) {
      await ws.close(0);
    }
  }

  function isClosed(): boolean {
    return ws.isClosed;
  }

  async function receive(): Promise<IncommingMessage> {
    const result = await iter.next();
    if (result.done) {
      throw new Error("WebSocket connection has been closed");
    }

    const message = result.value;
    if (typeof message === "string") {
      return JSON.parse(message);
    } else if (isWebSocketCloseEvent(message)) {
      await close();
      throw new Error("WebSocket connection has been closed");
    } else {
      throw new Error("Unexpected message received");
    }
  }

  return {
    send,
    close,
    isClosed,
    receive
  };
}
