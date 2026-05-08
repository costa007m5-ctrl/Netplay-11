import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teraboxRouter from "./terabox";
import proxyStreamRouter from "./proxy-stream";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teraboxRouter);
router.use(proxyStreamRouter);

export default router;
