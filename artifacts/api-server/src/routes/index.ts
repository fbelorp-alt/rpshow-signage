import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import screensRouter from "./screens";
import mediaRouter from "./media";
import playlistsRouter from "./playlists";
import schedulesRouter from "./schedules";
import dashboardRouter from "./dashboard";
import playerRouter from "./player";
import storageRouter from "./storage";
import reportsRouter from "./reports";
import operatorsRouter from "./operators";
import monitoringRouter from "./monitoring";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(authRouter);
router.use("/clients", clientsRouter);
router.use("/screens", screensRouter);
router.use("/media", mediaRouter);
router.use("/playlists", playlistsRouter);
router.use("/schedules", schedulesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/player", playerRouter);
router.use("/reports", reportsRouter);
router.use("/operators", operatorsRouter);
router.use("/monitoring", monitoringRouter);

export default router;
