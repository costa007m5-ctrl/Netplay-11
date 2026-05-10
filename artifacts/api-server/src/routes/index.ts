import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teraboxRouter from "./terabox";
import teraboxV2Router from "./terabox-v2";
import proxyStreamRouter from "./proxy-stream";
import keepwarmRouter from "./keepwarm";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teraboxRouter);
router.use(teraboxV2Router);
router.use(proxyStreamRouter);
router.use(keepwarmRouter);

export default router;
