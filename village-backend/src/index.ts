import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import postsRouter from './routes/posts';
import usersRouter from './routes/users';
import uploadRouter from './routes/upload';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/posts', postsRouter);
app.use('/users', usersRouter);
app.use('/upload', uploadRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});