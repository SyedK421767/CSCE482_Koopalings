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
      name TEXT,
      is_group BOOLEAN NOT NULL DEFAULT FALSE,
      owner_userid INTEGER REFERENCES users(userid) ON DELETE SET NULL,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    await db_1.default.query(`
    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversationid INTEGER NOT NULL REFERENCES conversations(conversationid) ON DELETE CASCADE,
      userid INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      role TEXT NOT NULL DEFAULT 'member',
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
