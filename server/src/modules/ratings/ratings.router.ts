import { Router } from 'express';
import { 
  getRatings, 
  getPlayerRating, 
  getRatingsTiers, 
  recomputeRatings 
} from './ratings.controller';

const router = Router();

// Main ratings endpoints
router.get('/', getRatings);
router.get('/tiers', getRatingsTiers);
router.get('/:id', getPlayerRating);

// Admin endpoint for recomputing ratings
router.post('/recompute', recomputeRatings);

export default router;