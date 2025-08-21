import { Router } from 'express';
import { getWeekly, getROS } from './sos.controller';

const router = Router();
router.get('/weekly', getWeekly); // /api/sos/weekly?position=RB&week=1
router.get('/ros', getROS);       // /api/sos/ros?position=RB&startWeek=1&window=5
export default router;