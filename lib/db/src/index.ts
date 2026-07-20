import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export { usersTable, sessionsTable } from "./schema/auth";
export { clientsTable, insertClientSchema } from "./schema/clients";
export { operatorsTable } from "./schema/operators";
export { subscriptionPaymentsTable } from "./schema/subscription-payments";
export { trustedDevicesTable } from "./schema/trusted-devices";
export { screenGroupsTable, insertScreenGroupSchema } from "./schema/screen-groups";
export { emergencyAlertsTable, insertEmergencyAlertSchema } from "./schema/emergency-alerts";
export { screensTable, brightnessSchedulesTable, insertScreenSchema } from "./schema/screens";
export { mediaTable, insertMediaSchema } from "./schema/media";
export { mediaPlaysTable } from "./schema/media-plays";
export { playlistsTable, playlistItemsTable, insertPlaylistSchema, insertPlaylistItemSchema } from "./schema/playlists";
export { schedulesTable, insertScheduleSchema } from "./schema/schedules";
export { activityTable, insertActivitySchema } from "./schema/activity";
export { devicesTable } from "./schema/devices";
export { passwordResetTokensTable } from "./schema/password-reset-tokens";
export { locationsTable, insertLocationSchema } from "./schema/locations";
export { screenConnectionsTable } from "./schema/screen-connections";
export { apkVersionsTable } from "./schema/apk-versions";
export type { ApkVersion } from "./schema/apk-versions";

export type { User, UpsertUser } from "./schema/auth";
export type { Client, InsertClient } from "./schema/clients";
export type { Operator } from "./schema/operators";
export type { SubscriptionPayment } from "./schema/subscription-payments";
export type { ScreenGroup, InsertScreenGroup } from "./schema/screen-groups";
export type { EmergencyAlert, InsertEmergencyAlert } from "./schema/emergency-alerts";
export type { Screen, InsertScreen, BrightnessSchedule } from "./schema/screens";
export type { Media, InsertMedia } from "./schema/media";
export type { MediaPlay } from "./schema/media-plays";
export type { Playlist, InsertPlaylist, PlaylistItem, InsertPlaylistItem } from "./schema/playlists";
export type { Schedule, InsertSchedule } from "./schema/schedules";
export type { Activity, InsertActivity } from "./schema/activity";
export type { Device } from "./schema/devices";
export type { PasswordResetToken } from "./schema/password-reset-tokens";
export type { Location, InsertLocation } from "./schema/locations";
