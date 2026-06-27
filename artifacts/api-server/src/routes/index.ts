import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import screensRouter from "./screens";
import mediaRouter from "./media";
import playlistsRouter from "./playlists";
import schedulesRouter from "./schedules";
import dashboardRouter from "./dashboard";
import playerRouter from "./player";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/clients", clientsRouter);
router.use("/screens", screensRouter);
router.use("/media", mediaRouter);
router.use("/playlists", playlistsRouter);
router.use("/schedules", schedulesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/player", playerRouter);

export default router;
