import { db } from "@workspace/db";
import { playlistsTable, playlistItemsTable, mediaTable } from "@workspace/db";
import { eq, asc, inArray } from "drizzle-orm";

export type PublishedSnapshotItem = {
  mediaId: number;
  position: number;
  durationSeconds: number;
  objectFit: string;
};

export type PublishedSnapshot = {
  items: PublishedSnapshotItem[];
  layoutJson: string | null;
  transitionEffect: string;
};

export function fingerprintDraft(input: {
  items: Array<{ mediaId: number; position: number; durationSeconds: number; objectFit?: string | null }>;
  layoutJson: string | null | undefined;
  transitionEffect: string | null | undefined;
}): string {
  const items = [...input.items]
    .map((i) => ({
      mediaId: i.mediaId,
      position: i.position,
      durationSeconds: i.durationSeconds,
      objectFit: i.objectFit ?? "contain",
    }))
    .sort((a, b) => a.position - b.position);
  return JSON.stringify({
    items,
    layoutJson: input.layoutJson ?? null,
    transitionEffect: input.transitionEffect ?? "fade",
  });
}

export function parsePublishedSnapshot(raw: string | null | undefined): PublishedSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PublishedSnapshot;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      items: parsed.items.map((i) => ({
        mediaId: Number(i.mediaId),
        position: Number(i.position) || 0,
        durationSeconds: Number(i.durationSeconds) || 10,
        objectFit: i.objectFit || "contain",
      })),
      layoutJson: parsed.layoutJson ?? null,
      transitionEffect: parsed.transitionEffect || "fade",
    };
  } catch {
    return null;
  }
}

export async function buildDraftSnapshot(playlistId: number): Promise<PublishedSnapshot | null> {
  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId));
  if (!playlist) return null;

  const items = await db
    .select({
      mediaId: playlistItemsTable.mediaId,
      position: playlistItemsTable.position,
      durationSeconds: playlistItemsTable.durationSeconds,
      objectFit: playlistItemsTable.objectFit,
    })
    .from(playlistItemsTable)
    .where(eq(playlistItemsTable.playlistId, playlistId))
    .orderBy(asc(playlistItemsTable.position));

  return {
    items: items.map((i) => ({
      mediaId: i.mediaId,
      position: i.position,
      durationSeconds: i.durationSeconds,
      objectFit: i.objectFit || "contain",
    })),
    layoutJson: playlist.layoutJson ?? null,
    transitionEffect: playlist.transitionEffect || "fade",
  };
}

export async function publishPlaylist(playlistId: number): Promise<{
  publishedAt: Date;
  itemCount: number;
  snapshot: PublishedSnapshot;
} | null> {
  const snapshot = await buildDraftSnapshot(playlistId);
  if (!snapshot) return null;

  const publishedAt = new Date();
  await db
    .update(playlistsTable)
    .set({
      publishedSnapshotJson: JSON.stringify(snapshot),
      publishedAt,
    })
    .where(eq(playlistsTable.id, playlistId));

  return { publishedAt, itemCount: snapshot.items.length, snapshot };
}

export async function loadPublishedOrLiveItems(playlistId: number): Promise<{
  items: Array<{
    mediaId: number | null;
    mediaUrl: string | null;
    mediaType: string | null;
    durationSeconds: number;
    mediaName: string | null;
    metaJson: string | null;
    objectFit: string;
  }>;
  layoutJson: string | null;
  transitionEffect: string;
  fromPublished: boolean;
  publishedAt: Date | null;
}> {
  const [playlist] = await db
    .select({
      layoutJson: playlistsTable.layoutJson,
      transitionEffect: playlistsTable.transitionEffect,
      publishedSnapshotJson: playlistsTable.publishedSnapshotJson,
      publishedAt: playlistsTable.publishedAt,
    })
    .from(playlistsTable)
    .where(eq(playlistsTable.id, playlistId));

  if (!playlist) {
    return {
      items: [],
      layoutJson: null,
      transitionEffect: "fade",
      fromPublished: false,
      publishedAt: null,
    };
  }

  const snap = parsePublishedSnapshot(playlist.publishedSnapshotJson);
  if (snap) {
    const mediaIds = [...new Set(snap.items.map((i) => i.mediaId))];
    const medias =
      mediaIds.length > 0
        ? await db
            .select({
              id: mediaTable.id,
              url: mediaTable.url,
              type: mediaTable.type,
              name: mediaTable.name,
              metaJson: mediaTable.metaJson,
            })
            .from(mediaTable)
            .where(inArray(mediaTable.id, mediaIds))
        : [];
    const byId = new Map(medias.map((m) => [m.id, m]));
    const items = [...snap.items]
      .sort((a, b) => a.position - b.position)
      .map((i) => {
        const m = byId.get(i.mediaId);
        return {
          mediaId: m?.id ?? i.mediaId,
          mediaUrl: m?.url ?? null,
          mediaType: m?.type ?? null,
          durationSeconds: i.durationSeconds,
          mediaName: m?.name ?? null,
          metaJson: m?.metaJson ?? null,
          objectFit: i.objectFit || "contain",
        };
      });

    return {
      items,
      layoutJson: snap.layoutJson,
      transitionEffect: snap.transitionEffect || "fade",
      fromPublished: true,
      publishedAt: playlist.publishedAt ?? null,
    };
  }

  // Migração: primeira vez sem snapshot → congela o rascunho atual como publicado.
  // Depois disso, edições no editor só vão à tela após "Publicar".
  const seeded = await publishPlaylist(playlistId);
  if (seeded) {
    return loadPublishedOrLiveItems(playlistId);
  }

  return {
    items: [],
    layoutJson: playlist.layoutJson ?? null,
    transitionEffect: playlist.transitionEffect || "fade",
    fromPublished: false,
    publishedAt: null,
  };
}
