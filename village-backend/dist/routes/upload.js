"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_1 = require("@google-cloud/storage");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const storage = new storage_1.Storage();
const bucket = storage.bucket('village-486422_cloudbuild');
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post('/', upload.single('image'), async (req, res) => {
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map