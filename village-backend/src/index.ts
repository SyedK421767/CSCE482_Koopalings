import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import postsRouter from './routes/posts';
import usersRouter from './routes/users';
import profilesRouter from './routes/profiles';
import uploadRouter from './routes/upload';
import chatRouter from './routes/chat';
import { initChatWebSocket } from './chat/wsHub';
import tagsRouter from './routes/tags';
import rsvpsRouter from './routes/rsvps';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use('/posts', postsRouter);
app.use('/users', usersRouter);
app.use('/profiles', profilesRouter);
app.use('/upload', uploadRouter);
app.use('/chat', chatRouter);
app.use('/tags', tagsRouter);
app.use('/rsvps', rsvpsRouter);

async function startServer() {
  try {
    initChatWebSocket(server);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

void startServer();
