import { Router, Request, Response } from 'express';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';

const router = Router();
const storage = new Storage();
const bucket = storage.bucket('village-486422_cloudbuild');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image provided' });
      return;
    }

    const filename = `post_images/${Date.now()}-${req.file.originalname}`;
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      contentType: req.file.mimetype,
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/village-486422_cloudbuild/${filename}`;
    res.status(200).json({ url: publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

export default router;