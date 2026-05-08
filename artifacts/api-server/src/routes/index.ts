import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teraboxRouter from "./terabox";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teraboxRouter);
router.use(notificationsRouter);

export default router;
