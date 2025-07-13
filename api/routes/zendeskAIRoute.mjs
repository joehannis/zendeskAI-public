import express from 'express';
const router = express.Router();
import zendeskAIController from '../controllers/zendeskAIController.mjs';

router.get('/', zendeskAIController);

export default router;
