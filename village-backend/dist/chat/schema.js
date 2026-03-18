"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureChatTables = ensureChatTables;
const db_1 = __importDefault(require("../db"));
async function ensureChatTables() {
    await db_1.default.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      conversationid SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    await db_1.default.query(`
    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversationid INTEGER NOT NULL REFERENCES conversations(conversationid) ON DELETE CASCADE,
      userid INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
      PRIMARY KEY (conversationid, userid)
    );
  `);
    await db_1.default.query(`
    CREATE TABLE IF NOT EXISTS messages (
      messageid SERIAL PRIMARY KEY,
      conversationid INTEGER NOT NULL REFERENCES conversations(conversationid) ON DELETE CASCADE,
      senderid INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
//# sourceMappingURL=schema.js.map