import { IncomingMessage, Server as HttpServer } from 'http';
import { createHash } from 'crypto';
import { Duplex } from 'stream';

type IdentifyMessage = {
  type: 'identify';
  userId: number;
};

const userSockets = new Map<number, Set<Duplex>>();
const socketUsers = new Map<Duplex, number>();

function addUserSocket(userId: number, socket: Duplex) {
  const sockets = userSockets.get(userId) ?? new Set<Duplex>();
  sockets.add(socket);
  userSockets.set(userId, sockets);
  socketUsers.set(socket, userId);
}

function removeUserSocket(socket: Duplex) {
  const userId = socketUsers.get(socket);
  if (!userId) return;

  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(socket);
    if (sockets.size === 0) {
      userSockets.delete(userId);
    }
  }

  socketUsers.delete(socket);
}

function encodeTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  const length = payload.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }

  if (length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

function decodeClientFrame(buffer: Buffer): string | null {
  if (buffer.length < 2) return null;
  const firstByte = buffer[0]!;
  const secondByte = buffer[1]!;
  const opcode = firstByte & 0x0f;
  const isMasked = (secondByte & 0x80) === 0x80;
  let offset = 2;
  let payloadLength = secondByte & 0x7f;

  if (opcode === 0x8) {
    return null;
  }

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) return null;
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) return null;
    const bigLen = buffer.readBigUInt64BE(offset);
    payloadLength = Number(bigLen);
    offset += 8;
  }

  if (!isMasked || buffer.length < offset + 4 + payloadLength) return null;
  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = buffer.subarray(offset, offset + payloadLength);
  const decoded = Buffer.alloc(payloadLength);

  for (let i = 0; i < payloadLength; i += 1) {
    decoded[i] = (payload[i] ?? 0) ^ (mask[i % 4] ?? 0);
  }

  return decoded.toString('utf8');
}

function handleSocketMessage(socket: Duplex, rawFrame: Buffer) {
  const rawText = decodeClientFrame(rawFrame);
  if (!rawText) return;

  try {
    const parsed = JSON.parse(rawText) as Partial<IdentifyMessage>;

    if (parsed.type === 'identify' && typeof parsed.userId === 'number') {
      addUserSocket(parsed.userId, socket);
      socket.write(encodeTextFrame(JSON.stringify({ type: 'identified', userId: parsed.userId })));
    }
  } catch (err) {
    console.error('Invalid WebSocket message:', err);
  }
}

function makeAcceptKey(webSocketKey: string) {
  return createHash('sha1')
    .update(`${webSocketKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
}

function upgradeToWebSocket(req: IncomingMessage, socket: Duplex) {
  const upgradeHeader = String(req.headers.upgrade ?? '').toLowerCase();
  const connectionHeader = String(req.headers.connection ?? '').toLowerCase();
  const secKey = req.headers['sec-websocket-key'];

  if (
    upgradeHeader !== 'websocket' ||
    !connectionHeader.includes('upgrade') ||
    typeof secKey !== 'string'
  ) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }

  const acceptKey = makeAcceptKey(secKey);
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '\r\n',
  ];

  socket.write(headers.join('\r\n'));

  socket.on('data', (buffer) => {
    const normalized = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    handleSocketMessage(socket, normalized);
  });

  socket.on('close', () => {
    removeUserSocket(socket);
  });

  socket.on('end', () => {
    removeUserSocket(socket);
  });

  socket.on('error', (err) => {
    console.error('WebSocket socket error:', err);
    removeUserSocket(socket);
  });
}

export function initChatWebSocket(server: HttpServer) {
  server.on('upgrade', (req, socket) => {
    const pathname = req.url?.split('?')[0];
    if (pathname !== '/ws') {
      socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
      return;
    }
    upgradeToWebSocket(req, socket);
  });
}

export function notifyUsers(userIds: number[], payload: unknown) {
  const message = JSON.stringify(payload);
  const uniqueUserIds = [...new Set(userIds)];

  for (const userId of uniqueUserIds) {
    const sockets = userSockets.get(userId);
    if (!sockets) continue;

    for (const socket of sockets) {
      if (!socket.destroyed) {
        socket.write(encodeTextFrame(message));
      }
    }
  }
}
