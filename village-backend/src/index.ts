import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import postsRouter from './routes/posts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/posts', postsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});