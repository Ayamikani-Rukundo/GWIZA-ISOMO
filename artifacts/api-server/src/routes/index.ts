import { Router, type IRouter } from "express";
import approvalRouter from "./approval";
import healthRouter from "./health";
import researchRouter from "./research";

const router: IRouter = Router();

router.use(healthRouter);
router.use(approvalRouter);
router.use(researchRouter);

export default router;
